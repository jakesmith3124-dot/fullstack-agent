"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertOwner, audit } from "@/lib/auth";
import { bool, londonDateTime, num, pounds, refreshPublic, str, type ActionResult } from "@/lib/admin";
import { processPhoto } from "@/lib/images";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Saves one content item. Field types come from the existing data shape. */
export async function saveContent(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("key, data").eq("id", id).single();
  if (!item) return { ok: false, error: "Not found." };
  const data = { ...(item.data as Record<string, unknown>) };
  for (const [k, v] of Object.entries(data)) {
    if (!fd.has(`f_${k}`)) continue;
    const raw = String(fd.get(`f_${k}`));
    if (k === "items" && Array.isArray(v) && Array.isArray(v[0])) {
      data[k] = raw.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]).map((p) => [p[0], p[1] ?? "", p[2] ?? ""]);
    } else if (Array.isArray(v)) {
      data[k] = raw.split("\n").map((x) => x.trim()).filter(Boolean);
    } else {
      data[k] = raw.trim();
    }
  }
  const { error } = await supabase.from("content_items").update({
    data, confirmed: bool(fd, "confirmed"), is_visible: bool(fd, "is_visible"),
    sort_order: num(fd, "sort_order") ?? 100, updated_at: new Date().toISOString(), updated_by: owner.id,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await audit("content_updated", "content_items", item.key, { confirmed: bool(fd, "confirmed") });
  refreshPublic();
  return { ok: true, message: bool(fd, "confirmed") ? "Saved and live." : "Saved. Hidden from the public until confirmed." };
}

const TEMPLATES: Record<string, { kind: string; data: Record<string, unknown> }> = {
  "faq.book": { kind: "faq", data: { q: "", a: "" } }, "faq.day": { kind: "faq", data: { q: "", a: "" } },
  "faq.health": { kind: "faq", data: { q: "", a: "" } }, "faq.more": { kind: "faq", data: { q: "", a: "" } },
  "pc.faq": { kind: "faq", data: { q: "", a: "" } },
  "team.members": { kind: "team", data: { name: "", role: "", initials: "", photo: null } },
  "safety.tiles": { kind: "tile", data: { icon: "✓", title: "", body: "" } },
};

export async function addContent(section: string): Promise<void> {
  await assertOwner();
  const t = TEMPLATES[section];
  if (!t) return;
  const supabase = await createClient();
  await supabase.from("content_items").insert({ key: `${section}.${randomUUID().slice(0, 8)}`, section, kind: t.kind, data: t.data, confirmed: false, sort_order: 500 });
  revalidatePath("/admin/content");
}

export async function deleteContent(id: string): Promise<void> {
  await assertOwner();
  const supabase = await createClient();
  const { data } = await supabase.from("content_items").select("key, section").eq("id", id).single();
  if (!data || !(data.section in TEMPLATES)) return; // only list items can be deleted
  await supabase.from("content_items").delete().eq("id", id);
  await audit("content_deleted", "content_items", data.key);
  refreshPublic();
}

/** Uploads a photo for a content item (page photos and team members). */
export async function uploadContentImage(id: string, field: "path" | "photo", _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose an image." };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "That image is too large (4 MB maximum)." };
  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("key, data").eq("id", id).single();
  if (!item) return { ok: false, error: "Not found." };
  const path = `content/${item.key.replace(/[^a-z0-9.]/gi, "-")}-${randomUUID().slice(0, 8)}.webp`;
  const db = createAdminClient();
  const { error } = await db.storage.from("site").upload(path, await processPhoto(Buffer.from(await file.arrayBuffer())), { contentType: "image/webp" });
  if (error) return { ok: false, error: error.message };
  const data = { ...(item.data as Record<string, unknown>), [field]: path, ...(fd.get("alt") ? { alt: String(fd.get("alt")) } : {}) };
  await supabase.from("content_items").update({ data }).eq("id", id);
  await audit("content_image_uploaded", "content_items", item.key);
  refreshPublic();
  return { ok: true, message: "Photo updated." };
}

// --- Settings -------------------------------------------------------------------
async function setSetting(key: string, value: unknown, confirmed?: boolean) {
  const owner = await assertOwner();
  const supabase = await createClient();
  const patch: Record<string, unknown> = { value, updated_at: new Date().toISOString(), updated_by: owner.id };
  if (confirmed !== undefined) patch.confirmed = confirmed;
  const { error } = await supabase.from("settings").update(patch).eq("key", key);
  if (error) throw new Error(error.message);
  await audit("setting_updated", "settings", key, { value: value as object, confirmed });
}

export async function saveSettings(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  try {
    const sib = num(fd, "sibling_discount_pct");
    if (sib === null || sib < 0 || sib > 100) return { ok: false, error: "Sibling discount must be between 0 and 100." };
    await setSetting("sibling_discount_pct", sib, bool(fd, "sibling_confirmed"));
    const minDays = num(fd, "min_days_before");
    const maxCount = num(fd, "max_count");
    if (minDays === null || minDays < 0 || maxCount === null || maxCount < 2 || maxCount > 6) return { ok: false, error: "Check the instalment rules (2 to 6 payments)." };
    await setSetting("instalments", {
      enabled: bool(fd, "instalments_enabled"), min_days_before: minDays, max_count: maxCount,
      retry_days: num(fd, "retry_days") ?? 2, max_attempts: num(fd, "max_attempts") ?? 3, unpaid_flag_days: num(fd, "unpaid_flag_days") ?? 3,
    }, bool(fd, "instalments_confirmed"));
    await setSetting("flags", {
      bookings_open: bool(fd, "flag_bookings_open"), prime_camps_bookings: bool(fd, "flag_prime_camps_bookings"),
      goat_memberships: bool(fd, "flag_goat_memberships"), holiday_pass: bool(fd, "flag_holiday_pass"),
    });
    const retention = num(fd, "retention_months");
    if (retention === null || retention < 1 || retention > 84) return { ok: false, error: "Retention must be between 1 and 84 months." };
    await setSetting("retention_months", retention, bool(fd, "retention_confirmed"));
    const hold = num(fd, "hold_minutes");
    if (hold === null || hold < 5 || hold > 60) return { ok: false, error: "Hold time must be 5 to 60 minutes." };
    await setSetting("hold_minutes", hold);
    const email = str(fd, "owner_notify_email");
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid notification email." };
    await setSetting("owner_notify_email", email);
    const groups = str(fd, "age_groups").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ name: p[0], min: Number(p[1]), max: Number(p[2]) }));
    if (groups.some((g) => !Number.isFinite(g.min) || !Number.isFinite(g.max))) return { ok: false, error: "Age groups: use one line each, like Minis | 5 | 7." };
    await setSetting("age_groups", groups, bool(fd, "age_groups_confirmed"));
    await setSetting("tax_free_childcare", { accepted: bool(fd, "tfc_accepted") }, bool(fd, "tfc_confirmed"));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  refreshPublic();
  return { ok: true, message: "Settings saved." };
}

// --- Discount codes -----------------------------------------------------------
export async function saveDiscount(id: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const code = str(fd, "code").toUpperCase().replace(/\s+/g, "");
  const kind = str(fd, "kind") === "fixed" ? "fixed" : "percent";
  const value = kind === "fixed" ? pounds(fd, "value") : num(fd, "value");
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { ok: false, error: "Codes use 3 to 30 letters or numbers." };
  if (!value || value <= 0 || (kind === "percent" && value > 100)) return { ok: false, error: "Check the discount amount." };
  const row = {
    code, kind, value, label: str(fd, "label") || null, active: bool(fd, "active"),
    expires_at: londonDateTime(str(fd, "expires_at")), usage_limit: num(fd, "usage_limit"),
    camp_ids: fd.getAll("camp_ids").map(String).filter(Boolean),
  };
  if (!row.camp_ids.length) (row as { camp_ids: string[] | null }).camp_ids = null;
  const supabase = await createClient();
  const { error } = id ? await supabase.from("discount_codes").update(row).eq("id", id) : await supabase.from("discount_codes").insert(row);
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "That code already exists." : error.message };
  await audit(id ? "discount_updated" : "discount_created", "discount_codes", code);
  revalidatePath("/admin/discounts");
  return { ok: true, message: "Saved." };
}

export async function deleteDiscount(id: string): Promise<void> {
  await assertOwner();
  const supabase = await createClient();
  await supabase.from("discount_codes").delete().eq("id", id);
  revalidatePath("/admin/discounts");
}

// --- Membership tiers -----------------------------------------------------------
export async function saveTier(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const price = pounds(fd, "price");
  if (!price || price <= 0) return { ok: false, error: "Enter a monthly price." };
  const supabase = await createClient();
  const { error } = await supabase.from("membership_tiers").update({ name: str(fd, "name"), price_pence: price, confirmed: bool(fd, "confirmed") }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await audit("tier_updated", "membership_tiers", id, { price_pence: price });
  refreshPublic();
  return { ok: true, message: "Saved." };
}
