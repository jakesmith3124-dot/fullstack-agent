"use server";
import { z } from "zod";
import { notifyOwner } from "@/lib/email";
import { rateLimit, verifyCaptcha } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/server";
import { contactSchema, earlyAccessSchema, firstError, goatSchema, schoolSchema } from "@/lib/validation";

export type LeadKind = "early_access" | "goat" | "school" | "contact";
export type LeadState = { ok: boolean; error?: string };

function formObject(fd: FormData) {
  const out: Record<string, unknown> = { interests: fd.getAll("interests").map(String) };
  for (const [k, v] of fd.entries()) if (k !== "interests") out[k] = String(v);
  return out;
}

export async function submitLead(kind: LeadKind, _prev: LeadState, fd: FormData): Promise<LeadState> {
  // Honeypot: real people never fill this hidden field.
  if (fd.get("company_website")) return { ok: true };
  if (!(await verifyCaptcha(fd.get("cf-turnstile-response") as string | null))) {
    return { ok: false, error: "Please complete the security check and try again." };
  }
  if (!(await rateLimit(`lead:${kind}`, 5, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const raw = formObject(fd);
  const db = createAdminClient();
  try {
    if (kind === "early_access") {
      const v = earlyAccessSchema.parse(raw);
      await insert(db, "early_access_signups", { first_name: v.first_name, email: v.email, area: v.area, children_ages: v.children_ages, marketing_consent: true });
      await notifyOwner("New Prime Camps early-access sign-up", [["Name", v.first_name], ["Email", v.email], ["Area", v.area], ["Children's ages", v.children_ages]], "/admin/leads");
    } else if (kind === "goat") {
      const v = goatSchema.parse(raw);
      await insert(db, "goat_waitlist", { first_name: v.first_name, email: v.email, area: v.area, player_age: v.player_age, consent: true });
      await notifyOwner("New G.O.A.T waiting-list sign-up", [["Name", v.first_name], ["Email", v.email], ["Area", v.area], ["Player's age", v.player_age]], "/admin/leads?tab=goat");
    } else if (kind === "school") {
      const v = schoolSchema.parse(raw);
      await insert(db, "school_enquiries", { school_name: v.school_name, contact_name: v.contact_name, role: v.role, email: v.email, phone: v.phone, interests: v.interests, message: v.message, consent: true });
      await notifyOwner(`School enquiry: ${v.school_name}`, [["School", v.school_name], ["Contact", v.contact_name], ["Role", v.role], ["Email", v.email], ["Phone", v.phone], ["Interested in", v.interests.join(", ")], ["Message", v.message]], "/admin/leads?tab=schools");
    } else {
      const v = contactSchema.parse(raw);
      await insert(db, "contact_messages", { name: v.name, email: v.email, phone: v.phone, message: v.message, consent: true });
      await notifyOwner(`Website message from ${v.name}`, [["Name", v.name], ["Email", v.email], ["Phone", v.phone], ["Message", v.message]], "/admin/leads?tab=contact");
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: firstError(e) };
    console.error("lead", kind, e);
    return { ok: false, error: "We couldn't save that just now. Please try again in a moment." };
  }
}

async function insert(db: ReturnType<typeof createAdminClient>, table: string, row: Record<string, unknown>) {
  const { error } = await db.from(table).insert(row);
  if (error) throw new Error(error.message);
}
