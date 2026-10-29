"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { todayLondon } from "@/lib/format";
import { notifyStaffForDay } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string; message?: string };

/** Confirms the child belongs to this parent and is booked on this day. */
async function ownChildOnDay(dayId: string, childId: string) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const { data: child } = await supabase.from("children").select("id, first_name, last_name, collectors").eq("id", childId).eq("parent_id", viewer.id).maybeSingle();
  if (!child) return null;
  const { data: place } = await supabase.from("booking_places").select("id, camp_days!inner(date), bookings!inner(status)").eq("child_id", childId).eq("camp_day_id", dayId).eq("bookings.status", "confirmed").limit(1);
  if (!place?.length) return null;
  return { viewer, child, date: (place[0].camp_days as unknown as { date: string }).date };
}

export async function setCollector(dayId: string, childId: string, name: string): Promise<Result> {
  const ctx = await ownChildOnDay(dayId, childId);
  if (!ctx) return { ok: false, error: "Not found." };
  const clean = name.trim().slice(0, 80);
  if (clean.length < 2) return { ok: false, error: "Add the name of the adult collecting." };
  await createAdminClient().from("pickup_passes").update({ collector_name: clean, updated_at: new Date().toISOString() }).eq("camp_day_id", dayId).eq("child_id", childId);
  revalidatePath("/app/pickup");
  return { ok: true, message: `${clean} is collecting` };
}

export async function sendLate(dayId: string, childId: string, eta: number): Promise<Result> {
  const ctx = await ownChildOnDay(dayId, childId);
  if (!ctx) return { ok: false, error: "Not found." };
  if (ctx.date !== todayLondon()) return { ok: false, error: "You can only send this on the day." };
  if (![10, 20, 30].includes(eta)) return { ok: false, error: "Choose how late you'll be." };
  const db = createAdminClient();
  await db.from("late_notices").insert({ camp_day_id: dayId, child_id: childId, parent_id: ctx.viewer.id, eta_minutes: eta });
  await notifyStaffForDay(dayId, { title: `Running late: ${ctx.child.first_name} ${ctx.child.last_name}`, body: `Parent says ${eta >= 30 ? "30+" : eta} minutes late.`, url: `/admin/register/${dayId}` });
  revalidatePath("/app/pickup");
  return { ok: true, message: `Coaches told you're ${eta >= 30 ? "30+" : eta} mins late` };
}

const signSchema = z.object({
  childId: z.uuid(),
  formKey: z.string().min(1).max(60),
  version: z.number().int().positive(),
  accepted: z.number().int().min(0),
  name: z.string().trim().min(3).max(120),
});

/** Consent forms: typed full name plus today's date, stored with a timestamp and the form version. */
export async function signConsentForm(input: z.infer<typeof signSchema>): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const v = signSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Something's missing. Please try again." };
  if (v.data.name.split(/\s+/).length < 2) return { ok: false, error: "Type your first and last name to sign." };
  const supabase = await createClient();
  const { data: form } = await supabase.from("consent_forms").select("key, version, statements, active").eq("key", v.data.formKey).eq("version", v.data.version).single();
  if (!form?.active) return { ok: false, error: "This form has been updated. Please refresh." };
  if (v.data.accepted !== form.statements.length) return { ok: false, error: "Tick every box to give consent." };
  const { error } = await supabase.from("consent_signatures").insert({
    child_id: v.data.childId, parent_id: viewer.id, form_key: form.key, form_version: form.version,
    signed_name: v.data.name, signed_on: todayLondon(),
  });
  if (error) return { ok: false, error: "We couldn't save your signature. Please try again." };
  if (form.key === "photo_activity") await supabase.from("children").update({ photo_consent: true }).eq("id", v.data.childId).eq("parent_id", viewer.id);
  revalidatePath("/app/child");
  return { ok: true, message: "Form signed" };
}

const subSchema = z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function savePushSubscription(sub: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const v = subSchema.safeParse(sub);
  if (!v.success) return { ok: false, error: "Invalid subscription." };
  const db = createAdminClient();
  await db.from("push_subscriptions").upsert({ user_id: viewer.id, endpoint: v.data.endpoint, p256dh: v.data.keys.p256dh, auth: v.data.keys.auth }, { onConflict: "endpoint" });
  return { ok: true, message: "Notifications on" };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false };
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", viewer.id);
  return { ok: true, message: "Notifications off" };
}
