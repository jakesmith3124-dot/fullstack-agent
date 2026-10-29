import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayLondon } from "@/lib/format";
import { ChildView, type AppChild } from "./ChildView";

export const metadata = { title: "Child" };
export const dynamic = "force-dynamic";

export default async function ChildPage() {
  const viewer = await requireViewer("/app/child");
  const supabase = await createClient();
  const [{ data: kids }, { data: forms }, { data: sigs }, { data: profile }, { data: places }] = await Promise.all([
    supabase.from("children").select("id, first_name, last_name, dob, medical, allergies, send, photo_consent, collectors").eq("parent_id", viewer.id).order("first_name"),
    supabase.from("consent_forms").select("key, version, title, body, statements").eq("active", true),
    supabase.from("consent_signatures").select("child_id, form_key, form_version").eq("parent_id", viewer.id),
    supabase.from("profiles").select("emergency_name").eq("id", viewer.id).single(),
    supabase.from("booking_places").select("child_id, camp_days!inner(date, camps(school)), bookings!inner(status)").eq("bookings.status", "confirmed").gte("camp_days.date", todayLondon()),
  ]);
  // Latest active version of each form.
  const latest = new Map<string, { key: string; version: number; title: string; body: string; statements: string[] }>();
  for (const f of forms ?? []) if (!latest.has(f.key) || latest.get(f.key)!.version < f.version) latest.set(f.key, f);
  const children: AppChild[] = (kids ?? []).map((k) => {
    const next = (places ?? []).filter((p) => p.child_id === k.id).map((p) => p.camp_days as unknown as { date: string; camps: { school: string } }).sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      id: k.id, firstName: k.first_name, lastName: k.last_name, dob: k.dob,
      hasMedical: !!(k.medical || k.allergies), hasSend: !!k.send, photoConsent: k.photo_consent, collectors: k.collectors,
      emergencySaved: !!profile?.emergency_name,
      formsToSign: [...latest.values()].filter((f) => !(sigs ?? []).some((s) => s.child_id === k.id && s.form_key === f.key && s.form_version === f.version)),
      nextCamp: next ? { school: next.camps.school, date: next.date } : null,
    };
  });
  return <ChildView kids={children} />;
}
