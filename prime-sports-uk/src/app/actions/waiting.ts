"use server";
import { z } from "zod";
import { notifyOwner } from "@/lib/email";
import { rateLimit, verifyCaptcha } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation";

const schema = z.object({
  day_id: z.uuid("Choose a day."),
  parent_name: z.string().trim().min(2, "Add your name.").max(80),
  parent_email: z.email("Enter a valid email address.").trim(),
  parent_phone: z.string().trim().max(30).optional().default(""),
  children_count: z.coerce.number().int().min(1).max(6),
});

export async function joinWaitingList(_prev: { ok: boolean; error?: string }, fd: FormData) {
  if (!(await verifyCaptcha(fd.get("cf-turnstile-response") as string | null))) return { ok: false, error: "Please complete the security check." };
  if (!(await rateLimit("waiting", 5, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;
  const db = createAdminClient();
  const { data: day } = await db.from("camp_days").select("date, camps(school)").eq("id", v.day_id).maybeSingle();
  if (!day) return { ok: false, error: "That day isn't available." };
  const { error } = await db.from("waiting_list").insert({ camp_day_id: v.day_id, parent_name: v.parent_name, parent_email: v.parent_email, parent_phone: v.parent_phone, children_count: v.children_count });
  if (error) return { ok: false, error: "We couldn't add you just now. Please try again." };
  const school = (day.camps as unknown as { school: string } | null)?.school ?? "";
  await notifyOwner(`Waiting list: ${school}, ${day.date}`, [["Name", v.parent_name], ["Email", v.parent_email], ["Phone", v.parent_phone], ["Children", String(v.children_count)]], "/admin/waiting-lists");
  return { ok: true };
}
