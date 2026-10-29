"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertStaff, audit } from "@/lib/auth";
import { fmtClock } from "@/lib/format";
import { processPhoto } from "@/lib/images";
import { notifyParent } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string; message?: string };

async function childOnDay(dayId: string, childId: string) {
  // Staff RLS: only returns rows for sessions this person is assigned to.
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("id, first_name, parent_id, collectors, photo_consent")
    .eq("id", childId)
    .maybeSingle();
  if (!data) return null;
  const { data: place } = await supabase.from("booking_places").select("id, bookings!inner(status)").eq("camp_day_id", dayId).eq("child_id", childId).eq("bookings.status", "confirmed").limit(1);
  return place?.length ? data : null;
}

export async function signInChild(dayId: string, childId: string): Promise<Result> {
  const staff = await assertStaff();
  const child = await childOnDay(dayId, childId);
  if (!child) return { ok: false, error: "This child isn't on this register." };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("register_entries").upsert({ camp_day_id: dayId, child_id: childId, signed_in_at: now, signed_in_by: staff.id }, { onConflict: "camp_day_id,child_id" });
  if (error) return { ok: false, error: error.message };
  await notifyParent(child.parent_id, "sign_in", { title: `${child.first_name} is signed in`, body: `Arrived at camp at ${fmtClock(now)}.`, url: "/app" });
  revalidatePath(`/admin/register/${dayId}`);
  return { ok: true };
}

export async function undoSignIn(dayId: string, childId: string): Promise<Result> {
  await assertStaff();
  const supabase = await createClient();
  await supabase.from("register_entries").update({ signed_in_at: null, signed_in_by: null, signed_out_at: null, signed_out_by: null, collected_by: null, collection_method: null }).eq("camp_day_id", dayId).eq("child_id", childId);
  await audit("register_undo", "register_entries", childId, { day: dayId });
  revalidatePath(`/admin/register/${dayId}`);
  return { ok: true };
}

/** Sign-out always records which adult collected the child. They must be on the authorised list. */
export async function signOutChild(dayId: string, childId: string, collectedBy: string, method: "qr" | "manual"): Promise<Result> {
  const staff = await assertStaff();
  const child = await childOnDay(dayId, childId);
  if (!child) return { ok: false, error: "This child isn't on this register." };
  const supabase = await createClient();
  const { data: pass } = await supabase.from("pickup_passes").select("collector_name").eq("camp_day_id", dayId).eq("child_id", childId).maybeSingle();
  const allowed = new Set([...(child.collectors as string[]), ...(pass?.collector_name ? [pass.collector_name] : [])].map((n) => n.toLowerCase()));
  if (!collectedBy || !allowed.has(collectedBy.toLowerCase())) {
    return { ok: false, error: `${collectedBy || "That person"} isn't an authorised adult for ${child.first_name}. Call the parent before releasing them.` };
  }
  const now = new Date().toISOString();
  const { data: entry } = await supabase.from("register_entries").select("signed_in_at").eq("camp_day_id", dayId).eq("child_id", childId).maybeSingle();
  if (!entry?.signed_in_at) return { ok: false, error: `${child.first_name} hasn't been signed in today.` };
  const { error } = await supabase.from("register_entries").update({ signed_out_at: now, signed_out_by: staff.id, collected_by: collectedBy, collection_method: method }).eq("camp_day_id", dayId).eq("child_id", childId);
  if (error) return { ok: false, error: error.message };
  await notifyParent(child.parent_id, "sign_out", { title: `${child.first_name} has been collected`, body: `Signed out to ${collectedBy} at ${fmtClock(now)}.`, url: "/app" });
  revalidatePath(`/admin/register/${dayId}`);
  return { ok: true, message: `${child.first_name} signed out to ${collectedBy}.` };
}

/** Looks up a scanned pickup pass. The QR holds a random token, never personal details. */
export async function resolvePass(dayId: string, token: string): Promise<{ ok: true; childId: string; name: string; collector: string | null; collectors: string[] } | { ok: false; error: string }> {
  await assertStaff();
  const clean = token.trim().replace(/^.*[?&#]t=/, "");
  const supabase = await createClient();
  const { data: pass } = await supabase.from("pickup_passes").select("child_id, collector_name, camp_day_id").or(`token.eq.${clean.replace(/[^A-Za-z0-9_-]/g, "")},code.eq.${clean.toUpperCase().replace(/[^A-Z0-9-]/g, "")}`).eq("camp_day_id", dayId).maybeSingle();
  if (!pass) return { ok: false, error: "That pass isn't for this camp today." };
  const { data: child } = await supabase.from("children").select("first_name, last_name, collectors").eq("id", pass.child_id).maybeSingle();
  if (!child) return { ok: false, error: "Child not found on this register." };
  return { ok: true, childId: pass.child_id, name: `${child.first_name} ${child.last_name}`, collector: pass.collector_name, collectors: child.collectors };
}

export async function acknowledgeLate(dayId: string, noticeId: string): Promise<Result> {
  const staff = await assertStaff();
  const db = createAdminClient();
  const supabase = await createClient();
  const { data: notice } = await supabase.from("late_notices").select("id, parent_id, eta_minutes, children(first_name)").eq("id", noticeId).maybeSingle();
  if (!notice) return { ok: false, error: "Not found." };
  await db.from("late_notices").update({ acknowledged_at: new Date().toISOString(), acknowledged_by: staff.id }).eq("id", noticeId);
  const name = (notice.children as unknown as { first_name: string }).first_name;
  await notifyParent(notice.parent_id, "late_ack", { title: "The coaches have your message", body: `${name} will wait with a coach until you arrive. See you soon.`, url: "/app/pickup" });
  revalidatePath(`/admin/register/${dayId}`);
  return { ok: true };
}

/** Staff post to the parent feed. Photos go to a private bucket; consent is checked by the database too. */
export async function createPost(dayId: string, _prev: Result, fd: FormData): Promise<Result> {
  const staff = await assertStaff();
  const supabase = await createClient();
  const { data: day } = await supabase.from("camp_days").select("id, camp_id, camps(school)").eq("id", dayId).maybeSingle();
  if (!day) return { ok: false, error: "You're not assigned to this camp." };
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const group = String(fd.get("group_name") ?? "").trim() || null;
  const tagged = fd.getAll("tagged").map(String);
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 6);
  if (!title) return { ok: false, error: "Add a title." };
  if (files.length && fd.get("consent_check") !== "on") return { ok: false, error: "Confirm that only children with photo consent appear in these photos." };
  if (tagged.length) {
    const { data: kids } = await supabase.from("children").select("id, first_name, photo_consent").in("id", tagged);
    const blocked = (kids ?? []).filter((k) => !k.photo_consent);
    if (files.length && blocked.length) return { ok: false, error: `${blocked.map((k) => k.first_name).join(", ")} ${blocked.length > 1 ? "don't" : "doesn't"} have photo consent. Remove them from the photo.` };
  }
  const db = createAdminClient();
  const paths: string[] = [];
  for (const f of files) {
    if (f.size > 4 * 1024 * 1024) return { ok: false, error: "Each photo must be under 4 MB." };
    const path = `${day.camp_id}/${dayId}/${randomUUID()}.webp`;
    const { error } = await db.storage.from("camp-photos").upload(path, await processPhoto(Buffer.from(await f.arrayBuffer()), 1400), { contentType: "image/webp" });
    if (error) return { ok: false, error: error.message };
    paths.push(path);
  }
  const { error } = await supabase.from("camp_posts").insert({
    camp_id: day.camp_id, camp_day_id: dayId, group_name: group, kind: paths.length ? "photo" : fd.get("notice") === "on" ? "notice" : "note",
    title, body: body || null, photo_paths: paths, tagged_child_ids: tagged, author_id: staff.id,
  });
  if (error) {
    if (paths.length) await db.storage.from("camp-photos").remove(paths);
    return { ok: false, error: error.message === "NO_PHOTO_CONSENT" ? "A tagged child doesn't have photo consent." : error.message };
  }
  // Tell the families booked on this day.
  const { data: parents } = await db.from("booking_places").select("bookings!inner(parent_id, status)").eq("camp_day_id", dayId).eq("bookings.status", "confirmed");
  const ids = [...new Set((parents ?? []).map((p) => (p.bookings as unknown as { parent_id: string }).parent_id))];
  await Promise.all(ids.map((id) => notifyParent(id, "updates", { title: `New from camp: ${title}`, body: body.slice(0, 120) || "Tap to see the latest from camp.", url: "/app/updates", tag: "updates" }, { emailFallback: false })));
  revalidatePath(`/admin/register/${dayId}`);
  return { ok: true, message: "Posted to the parent app." };
}
