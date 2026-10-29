"use server";
import { revalidatePath } from "next/cache";
import { NoticeEmail } from "@/emails/templates";
import { assertOwner, audit } from "@/lib/auth";
import { str, type ActionResult } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function addStaff(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") === "owner" ? "owner" : "staff";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  const db = createAdminClient();
  let { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!profile) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) return { ok: false, error: error?.message ?? "Couldn't create the account." };
    profile = { id: data.user.id };
  }
  await db.from("profiles").update({ role, full_name: name || undefined }).eq("id", profile.id);
  await audit("staff_added", "profiles", profile.id, { email, role });
  await sendEmail({
    to: email,
    subject: "You've been added to Prime Sports UK",
    react: NoticeEmail({
      title: "Welcome to the team",
      lines: [`You've been given a ${role} account on the Prime Sports UK website.`, "Sign in with this email address. The first time, you'll set up two-step sign-in with an authenticator app on your phone."],
      buttonLabel: "Sign in",
      buttonHref: "/login?next=/admin",
    }),
  });
  revalidatePath("/admin/staff");
  return { ok: true, message: `${email} added as ${role}.` };
}

export async function setRole(profileId: string, role: "owner" | "staff" | "parent"): Promise<void> {
  const owner = await assertOwner();
  if (profileId === owner.id && role !== "owner") return; // don't lock yourself out
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (role === "parent") await supabase.from("staff_assignments").delete().eq("staff_id", profileId);
  await audit("role_changed", "profiles", profileId, { role });
  revalidatePath("/admin/staff");
}

export async function addAssignment(staffId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const campId = str(fd, "camp_id");
  const dayId = str(fd, "day_id") || null;
  if (!campId) return { ok: false, error: "Choose a camp." };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_assignments").insert({ staff_id: staffId, camp_id: campId, camp_day_id: dayId });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "Already assigned." : error.message };
  await audit("staff_assigned", "staff_assignments", staffId, { camp_id: campId, day_id: dayId });
  revalidatePath("/admin/staff");
  return { ok: true, message: "Assigned." };
}

export async function removeAssignment(id: string): Promise<void> {
  await assertOwner();
  const supabase = await createClient();
  await supabase.from("staff_assignments").delete().eq("id", id);
  revalidatePath("/admin/staff");
}
