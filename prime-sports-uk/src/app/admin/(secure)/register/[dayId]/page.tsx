import Link from "next/link";
import { notFound } from "next/navigation";
import { audit, requireStaff } from "@/lib/auth";
import { ageOn, longDate, timeRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getAgeGroups } from "@/lib/data";
import { RegisterClient, type RegisterRow } from "./RegisterClient";

export default async function RegisterPage({ params }: PageProps<"/admin/register/[dayId]">) {
  const { dayId } = await params;
  await requireStaff(`/admin/register/${dayId}`);
  const supabase = await createClient();
  const { data: day } = await supabase.from("camp_days").select("id, date, camp_id, camps(school, start_time, end_time, brand)").eq("id", dayId).maybeSingle();
  if (!day) notFound();
  const { data: assigned } = await supabase.rpc("is_assigned_to_day", { p_day: dayId });
  if (!assigned) notFound();
  const camp = day.camps as unknown as { school: string; start_time: string; end_time: string; brand: string };
  const [{ data: places }, { data: entries }, { data: passes }, { data: late }, { groups }] = await Promise.all([
    supabase.from("booking_places").select("child_id, bookings!inner(status, parent_name, parent_phone, emergency_name, emergency_phone), children(id, first_name, last_name, dob, medical, allergies, send, photo_consent, collectors)").eq("camp_day_id", dayId).eq("bookings.status", "confirmed"),
    supabase.from("register_entries").select("child_id, signed_in_at, signed_out_at, collected_by, collection_method").eq("camp_day_id", dayId),
    supabase.from("pickup_passes").select("child_id, collector_name").eq("camp_day_id", dayId),
    supabase.from("late_notices").select("id, child_id, eta_minutes, created_at, acknowledged_at").eq("camp_day_id", dayId).order("created_at", { ascending: false }),
    getAgeGroups(),
  ]);
  await audit("register_viewed", "camp_days", dayId, { children: places?.length ?? 0 });

  const entryBy = new Map((entries ?? []).map((e) => [e.child_id, e]));
  const passBy = new Map((passes ?? []).map((p) => [p.child_id, p.collector_name]));
  const rows: RegisterRow[] = [];
  const seen = new Set<string>();
  for (const p of places ?? []) {
    const c = p.children as unknown as { id: string; first_name: string; last_name: string; dob: string; medical: string | null; allergies: string | null; send: string | null; photo_consent: boolean; collectors: string[] } | null;
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    const b = p.bookings as unknown as { parent_name: string; parent_phone: string; emergency_name: string; emergency_phone: string };
    const age = ageOn(c.dob, day.date);
    const e = entryBy.get(c.id);
    rows.push({
      id: c.id, name: `${c.first_name} ${c.last_name}`, age, group: camp.brand === "prime_camps" ? groups.find((g) => age >= g.min && age <= g.max)?.name ?? null : null,
      medical: [c.medical, c.allergies].filter(Boolean).join(" · "), send: c.send, photo: c.photo_consent, collectors: c.collectors,
      passCollector: passBy.get(c.id) ?? null, parentName: b.parent_name, parentPhone: b.parent_phone, emergency: `${b.emergency_name} ${b.emergency_phone}`,
      signedInAt: e?.signed_in_at ?? null, signedOutAt: e?.signed_out_at ?? null, collectedBy: e?.collected_by ?? null,
      late: (late ?? []).filter((l) => l.child_id === c.id && !l.acknowledged_at).map((l) => ({ id: l.id, eta: l.eta_minutes, at: l.created_at })),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <p><Link href="/admin/register">← Registers</Link></p>
      <h1 className="admin-title">{camp.school}</h1>
      <p className="muted">{longDate(day.date)} · {timeRange(camp.start_time, camp.end_time)} · {rows.length} children · {rows.filter((r) => r.medical).length} with medical needs · {rows.filter((r) => !r.photo).length} no photos</p>
      <RegisterClient dayId={dayId} rows={rows} groups={[...new Set(rows.map((r) => r.group).filter(Boolean))] as string[]} />
    </>
  );
}
