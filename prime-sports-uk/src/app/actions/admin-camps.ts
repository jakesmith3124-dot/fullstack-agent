"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOwner, audit } from "@/lib/auth";
import { bool, londonDateTime, num, pounds, refreshPublic, str, type ActionResult } from "@/lib/admin";
import { slugify } from "@/lib/format";
import { processLogo, processPhoto } from "@/lib/images";
import { addDays } from "@/lib/pricing";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function parseTimetable(text: string): [string, string, string][] {
  return text.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0] && p[1]).map((p) => [p[0], p[1], p[2] ?? ""]);
}

export async function saveCamp(campId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const school = str(fd, "school");
  const area = str(fd, "area");
  const ageMin = num(fd, "age_min");
  const ageMax = num(fd, "age_max");
  const price = pounds(fd, "price_per_day");
  if (school.length < 2) return { ok: false, error: "Add the school or venue name." };
  if (area.length < 2) return { ok: false, error: "Add the area or town." };
  if (ageMin === null || ageMax === null || ageMin > ageMax) return { ok: false, error: "Check the age range." };
  if (price === null || price < 0) return { ok: false, error: "Add a price per day." };
  const row = {
    school, area,
    brand: str(fd, "brand") === "prime_camps" ? "prime_camps" : "holiday",
    address: str(fd, "address") || null,
    postcode: str(fd, "postcode").toUpperCase() || null,
    description: str(fd, "description") || null,
    age_min: ageMin, age_max: ageMax,
    start_time: str(fd, "start_time") || "09:00",
    end_time: str(fd, "end_time") || "15:00",
    price_per_day_pence: price,
    full_week_price_pence: pounds(fd, "full_week_price"),
    booking_opens_at: londonDateTime(str(fd, "booking_opens_at")),
    booking_closes_at: londonDateTime(str(fd, "booking_closes_at")),
    what_to_bring: str(fd, "what_to_bring") || null,
    photo_alt: str(fd, "photo_alt") || null,
    timetable: parseTimetable(str(fd, "timetable")),
    sort_order: num(fd, "sort_order") ?? 10,
    is_visible: bool(fd, "is_visible"),
    confirmed: bool(fd, "confirmed"),
  };
  const supabase = await createClient();
  if (campId) {
    const { error } = await supabase.from("camps").update(row).eq("id", campId);
    if (error) return { ok: false, error: error.message };
    await audit("camp_updated", "camps", campId, { school });
    refreshPublic();
    return { ok: true, message: "Saved." };
  }
  const slugBase = slugify(str(fd, "slug") || `${school} ${area}`);
  let slug = slugBase;
  for (let i = 2; ; i++) {
    const { data } = await supabase.from("camps").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${slugBase}-${i}`;
  }
  const { data, error } = await supabase.from("camps").insert({ ...row, slug }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't create the camp." };
  await audit("camp_created", "camps", data.id, { school });
  refreshPublic();
  redirect(`/admin/camps/${data.id}?created=1`);
}

export async function deleteCamp(campId: string): Promise<ActionResult> {
  await assertOwner();
  const supabase = await createClient();
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("camp_id", campId).in("status", ["confirmed", "pending"]);
  if (count) return { ok: false, error: "This camp has bookings, so it can't be deleted. Hide it instead." };
  await supabase.from("bookings").delete().eq("camp_id", campId);
  const { error } = await supabase.from("camps").delete().eq("id", campId);
  if (error) return { ok: false, error: error.message };
  await audit("camp_deleted", "camps", campId);
  refreshPublic();
  redirect("/admin/camps");
}

export async function moveCamp(campId: string, direction: -1 | 1): Promise<void> {
  await assertOwner();
  const supabase = await createClient();
  const { data: camps } = await supabase.from("camps").select("id, sort_order").order("sort_order").order("school");
  const list = camps ?? [];
  const i = list.findIndex((c) => c.id === campId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((c, k) => supabase.from("camps").update({ sort_order: (k + 1) * 10 }).eq("id", c.id)));
  refreshPublic();
  revalidatePath("/admin/camps");
}

export async function setCampFlag(campId: string, field: "is_visible" | "confirmed", value: boolean): Promise<void> {
  await assertOwner();
  const supabase = await createClient();
  await supabase.from("camps").update({ [field]: value }).eq("id", campId);
  await audit(`camp_${field}_${value}`, "camps", campId);
  refreshPublic();
  revalidatePath("/admin/camps");
}

export async function addCampDays(campId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const from = str(fd, "from");
  const to = str(fd, "to") || from;
  const capacity = num(fd, "capacity");
  const weekdaysOnly = bool(fd, "weekdays_only");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || to < from) return { ok: false, error: "Choose the first and last dates." };
  if (capacity === null || capacity < 0) return { ok: false, error: "Set the number of places per day." };
  const rows: { camp_id: string; date: string; capacity: number }[] = [];
  for (let d = from; d <= to && rows.length < 60; d = addDays(d, 1)) {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (weekdaysOnly && (dow === 0 || dow === 6)) continue;
    rows.push({ camp_id: campId, date: d, capacity });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("camp_days").upsert(rows, { onConflict: "camp_id,date", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  refreshPublic();
  return { ok: true, message: `Added ${rows.length} day${rows.length === 1 ? "" : "s"}.` };
}

export async function updateDayCapacity(dayId: string, capacity: number): Promise<ActionResult> {
  await assertOwner();
  if (!Number.isInteger(capacity) || capacity < 0) return { ok: false, error: "Enter a whole number." };
  const supabase = await createClient();
  const { error } = await supabase.from("camp_days").update({ capacity }).eq("id", dayId);
  if (error) return { ok: false, error: error.message };
  refreshPublic();
  return { ok: true, message: "Capacity updated." };
}

export async function removeDay(dayId: string): Promise<ActionResult> {
  await assertOwner();
  const supabase = await createClient();
  const { count } = await supabase.from("booking_places").select("id", { count: "exact", head: true }).eq("camp_day_id", dayId);
  if (count) return { ok: false, error: "This day has bookings, so it can't be removed. Set its capacity to stop new bookings." };
  const { error } = await supabase.from("camp_days").delete().eq("id", dayId);
  if (error) return { ok: false, error: error.message };
  refreshPublic();
  return { ok: true };
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "image/gif"];

async function readImage(fd: FormData, key: string): Promise<Buffer | string> {
  const file = fd.get(key);
  if (!(file instanceof File) || !file.size) return "Choose an image.";
  if (!IMAGE_TYPES.includes(file.type)) return "Use a PNG, JPEG or WebP image.";
  if (file.size > 4 * 1024 * 1024) return "That image is too large (4 MB maximum).";
  return Buffer.from(await file.arrayBuffer());
}

/** Camp card photo (already cropped in the browser). */
export async function uploadCampPhoto(campId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const img = await readImage(fd, "file");
  if (typeof img === "string") return { ok: false, error: img };
  const db = createAdminClient();
  const path = `camps/${campId}/${randomUUID()}.webp`;
  const { error } = await db.storage.from("site").upload(path, await processPhoto(img), { contentType: "image/webp" });
  if (error) return { ok: false, error: error.message };
  const supabase = await createClient();
  const { data: old } = await supabase.from("camps").select("photo_path").eq("id", campId).single();
  await supabase.from("camps").update({ photo_path: path, photo_alt: str(fd, "alt") || null }).eq("id", campId);
  if (old?.photo_path) await db.storage.from("site").remove([old.photo_path]);
  await audit("camp_photo_uploaded", "camps", campId);
  refreshPublic();
  return { ok: true, message: "Photo updated." };
}

/** School logo: background removed, trimmed and centred. The original is kept privately. */
export async function uploadCampLogo(campId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const img = await readImage(fd, "file");
  if (typeof img === "string") return { ok: false, error: img };
  const db = createAdminClient();
  const id = randomUUID();
  let processed: Buffer;
  try {
    processed = await processLogo(img);
  } catch {
    return { ok: false, error: "We couldn't read that image. Try a PNG or JPEG." };
  }
  const logoPath = `logos/${campId}-${id}.png`;
  const originalPath = `logos/${campId}-${id}-original`;
  const [a, b] = await Promise.all([
    db.storage.from("site").upload(logoPath, processed, { contentType: "image/png" }),
    db.storage.from("originals").upload(originalPath, img, { contentType: (fd.get("file") as File).type }),
  ]);
  if (a.error || b.error) return { ok: false, error: (a.error || b.error)!.message };
  const supabase = await createClient();
  const { data: old } = await supabase.from("camps").select("logo_path").eq("id", campId).single();
  await supabase.from("camps").update({ logo_path: logoPath, logo_original_path: originalPath }).eq("id", campId);
  if (old?.logo_path && old.logo_path.startsWith(`logos/${campId}-`)) await db.storage.from("site").remove([old.logo_path]);
  await audit("camp_logo_uploaded", "camps", campId);
  refreshPublic();
  return { ok: true, message: "Logo processed and saved." };
}

export async function clearCampImage(campId: string, which: "photo" | "logo"): Promise<void> {
  await assertOwner();
  const supabase = await createClient();
  await supabase.from("camps").update(which === "photo" ? { photo_path: null } : { logo_path: null }).eq("id", campId);
  refreshPublic();
  revalidatePath(`/admin/camps/${campId}`);
}
