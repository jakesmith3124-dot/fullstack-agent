"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { recordPayment } from "@/lib/bookings";
import { fakePaymentsEnabled } from "@/lib/env";
import { todayLondon } from "@/lib/format";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { firstError, splitCollectors } from "@/lib/validation";

type Result = { ok: boolean; error?: string; message?: string };

const detailsSchema = z.object({
  full_name: z.string().trim().min(2, "Add your name.").max(80),
  phone: z.string().trim().min(10, "Enter a phone number.").max(20).regex(/^[0-9 +()-]+$/, "Enter a valid phone number."),
  emergency_name: z.string().trim().max(80).optional().default(""),
  emergency_phone: z.string().trim().max(20).optional().default(""),
  emergency_relationship: z.string().trim().max(60).optional().default(""),
});

export async function saveDetails(_prev: Result, fd: FormData): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const parsed = detailsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const prefs = Object.fromEntries(["sign_in", "sign_out", "updates", "late_ack", "pickup_reminder", "email_fallback"].map((k) => [k, fd.get(`pref_${k}`) === "on"]));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ ...parsed.data, notification_prefs: prefs }).eq("id", viewer.id);
  if (error) return { ok: false, error: "We couldn't save your details. Please try again." };
  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}

const childSchema = z.object({
  first_name: z.string().trim().min(1, "Add their first name.").max(60),
  last_name: z.string().trim().min(1, "Add their surname.").max(60),
  dob: z.iso.date("Add their date of birth."),
  school: z.string().trim().max(120).optional().default(""),
  medical: z.string().trim().max(1000).optional().default(""),
  allergies: z.string().trim().max(500).optional().default(""),
  send: z.string().trim().max(500).optional().default(""),
  collectors: z.string().trim().min(2, "Tell us who can collect them.").max(300),
  photo_consent: z.enum(["yes", "no"], { error: "Choose a photo option." }),
});

export async function saveChild(childId: string | null, _prev: Result, fd: FormData): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const parsed = childSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;
  const row = {
    first_name: v.first_name, last_name: v.last_name, dob: v.dob, school: v.school || null,
    medical: v.medical || null, allergies: v.allergies || null, send: v.send || null,
    collectors: splitCollectors(v.collectors), photo_consent: v.photo_consent === "yes",
  };
  const supabase = await createClient();
  const { error } = childId
    ? await supabase.from("children").update(row).eq("id", childId)
    : await supabase.from("children").insert({ ...row, parent_id: viewer.id });
  if (error) return { ok: false, error: "We couldn't save that. Please try again." };
  revalidatePath("/account");
  if (!childId) redirect("/account#children");
  return { ok: true, message: "Saved. Staff will see these details at the next camp." };
}

export async function deleteChild(childId: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data: upcoming } = await supabase
    .from("booking_places")
    .select("camp_days(date), bookings!inner(status)")
    .eq("child_id", childId)
    .eq("bookings.status", "confirmed");
  if ((upcoming ?? []).some((p) => (p.camp_days as unknown as { date: string }).date >= todayLondon())) {
    return { ok: false, error: "This child has upcoming bookings. Contact us to cancel them first." };
  }
  const { error } = await supabase.from("children").delete().eq("id", childId).eq("parent_id", viewer.id);
  if (error) return { ok: false, error: "We couldn't remove this child. Please contact us." };
  revalidatePath("/account");
  redirect("/account#children");
}

/** Lets a parent pay a failed or upcoming instalment now (and save a new card for the rest). */
export async function payInstalment(instalmentId: string): Promise<{ ok: true; clientSecret?: string; paid?: boolean } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  // RLS: only returns the row if this parent owns the booking.
  const { data: inst } = await supabase.from("instalments").select("id, booking_id, seq, amount_pence, status, attempts, bookings(ref, stripe_customer_id, instalment_count)").eq("id", instalmentId).maybeSingle();
  if (!inst || inst.status === "paid" || inst.status === "processing") return { ok: false, error: "This payment can't be made right now." };
  const b = inst.bookings as unknown as { ref: string; stripe_customer_id: string | null; instalment_count: number };
  if (!stripeConfigured()) {
    if (!fakePaymentsEnabled()) return { ok: false, error: "Online payments aren't available. Please contact us." };
    await recordPayment({ bookingId: inst.booking_id, paymentIntentId: `fake_pi_${inst.id}_manual`, amountPence: inst.amount_pence, instalmentId: inst.id });
    revalidatePath("/account");
    return { ok: true, paid: true };
  }
  const pi = await getStripe().paymentIntents.create(
    {
      amount: inst.amount_pence, currency: "gbp", customer: b.stripe_customer_id ?? undefined,
      setup_future_usage: "off_session", automatic_payment_methods: { enabled: true },
      description: `Instalment ${inst.seq} of ${b.instalment_count} (${b.ref})`,
      metadata: { kind: "instalment", booking_id: inst.booking_id, ref: b.ref, instalment_id: inst.id },
    },
    { idempotencyKey: `instalment-${inst.id}-manual-${inst.attempts}` },
  );
  return { ok: true, clientSecret: pi.client_secret! };
}

export async function membershipAction(membershipId: string, action: "pause" | "resume" | "cancel" | "undo_cancel"): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("memberships").select("id, stripe_subscription_id").eq("id", membershipId).maybeSingle();
  if (!m) return { ok: false, error: "Membership not found." };
  const db = createAdminClient();
  if (m.stripe_subscription_id && stripeConfigured()) {
    const stripe = getStripe();
    const sub =
      action === "pause" ? await stripe.subscriptions.update(m.stripe_subscription_id, { pause_collection: { behavior: "void" } })
      : action === "resume" ? await stripe.subscriptions.update(m.stripe_subscription_id, { pause_collection: "" })
      : action === "cancel" ? await stripe.subscriptions.update(m.stripe_subscription_id, { cancel_at_period_end: true })
      : await stripe.subscriptions.update(m.stripe_subscription_id, { cancel_at_period_end: false });
    const { syncSubscription } = await import("@/lib/memberships");
    await syncSubscription(sub);
  } else {
    const patch =
      action === "pause" ? { paused: true, status: "paused" }
      : action === "resume" ? { paused: false, status: "active" }
      : action === "cancel" ? { cancel_at_period_end: true }
      : { cancel_at_period_end: false };
    await db.from("memberships").update(patch).eq("id", m.id);
  }
  revalidatePath("/account");
  return { ok: true, message: action === "cancel" ? "Your membership will end at the end of this billing period." : "Updated." };
}

/**
 * Deletes a parent's personal data. Payment records are kept (anonymised) for tax purposes.
 * Refused while there are upcoming bookings, so camps never lose medical or collection details.
 */
export async function deleteMyData(_prev: Result, fd: FormData): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (String(fd.get("confirm") || "").trim().toUpperCase() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
  if (viewer.role !== "parent") return { ok: false, error: "Staff accounts are removed by the owner." };
  const db = createAdminClient();
  const today = todayLondon();
  const { data: bookings } = await db.from("bookings").select("id, status, booking_places(camp_days(date))").eq("parent_id", viewer.id);
  const upcoming = (bookings ?? []).some((b) => b.status === "confirmed" && ((b.booking_places ?? []) as unknown as { camp_days: { date: string } }[]).some((p) => p.camp_days.date >= today));
  if (upcoming) return { ok: false, error: "You have upcoming bookings. Please contact us to cancel them before deleting your data." };

  const { data: subs } = await db.from("memberships").select("stripe_subscription_id, status").eq("parent_id", viewer.id);
  if (stripeConfigured()) {
    for (const s of subs ?? []) if (s.stripe_subscription_id && s.status !== "cancelled") await getStripe().subscriptions.cancel(s.stripe_subscription_id).catch(() => null);
  }
  const anon = `deleted-${viewer.id.slice(0, 8)}@deleted.invalid`;
  await db.from("children").delete().eq("parent_id", viewer.id);
  await db.from("push_subscriptions").delete().eq("user_id", viewer.id);
  await db.from("bookings").update({ parent_name: "Deleted parent", parent_email: anon, parent_phone: "", emergency_name: "", emergency_phone: "", emergency_relationship: "" }).eq("parent_id", viewer.id);
  await db.from("profiles").update({ email: anon, full_name: null, phone: null, emergency_name: null, emergency_phone: null, emergency_relationship: null }).eq("id", viewer.id);
  await db.auth.admin.updateUserById(viewer.id, { email: anon, ban_duration: "876000h" });
  await db.from("audit_log").insert({ actor_id: viewer.id, action: "account_deleted", entity: "profiles", entity_id: viewer.id });
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
