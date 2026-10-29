import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { getAgeGroups } from "./data";
import { ageOn, timeRange, todayLondon } from "./format";
import { createAdminClient, createClient } from "./supabase/server";

export type TodayChild = {
  id: string; firstName: string; lastName: string; age: number; group: string | null;
  photoConsent: boolean; collectors: string[];
  dayId: string; date: string; dayIndex: number; dayCount: number;
  camp: { id: string; school: string; address: string | null; times: string; endTime: string; timetable: [string, string, string][] };
  status: "not_arrived" | "in" | "out"; signedInAt: string | null; signedOutAt: string | null; collectedBy: string | null;
  pass: { token: string; code: string; collector: string | null };
  lateSent: { eta: number; at: string; acknowledged: boolean } | null;
};
export type TodayData = {
  date: string;
  children: TodayChild[];
  notices: { id: string; title: string; body: string | null; at: string }[];
  nextCamp: { school: string; date: string; children: string[] } | null;
  allChildren: { id: string; firstName: string }[];
};

/** Everything the parent app needs for today, for the signed-in parent only (RLS applies). */
export async function getToday(parentId: string, date = todayLondon()): Promise<TodayData> {
  const supabase = await createClient();
  const { data: kids } = await supabase.from("children").select("id, first_name, last_name, dob, photo_consent, collectors").eq("parent_id", parentId).order("first_name");
  const childIds = (kids ?? []).map((k) => k.id);
  if (!childIds.length) return { date, children: [], notices: [], nextCamp: null, allChildren: [] };

  const { data: places } = await supabase
    .from("booking_places")
    .select("child_id, booking_id, camp_days(id, date, camps(id, school, address, area, postcode, start_time, end_time, timetable, brand)), bookings!inner(status)")
    .in("child_id", childIds)
    .eq("bookings.status", "confirmed");
  type Place = { child_id: string; booking_id: string; camp_days: { id: string; date: string; camps: { id: string; school: string; address: string | null; area: string; postcode: string | null; start_time: string; end_time: string; timetable: [string, string, string][]; brand: string } } };
  const all = (places ?? []) as unknown as Place[];
  const today = all.filter((p) => p.camp_days.date === date);
  const { groups } = await getAgeGroups();
  const db = createAdminClient();

  const children: TodayChild[] = [];
  for (const p of today) {
    const k = kids!.find((x) => x.id === p.child_id)!;
    if (children.some((c) => c.id === k.id)) continue;
    const day = p.camp_days;
    const sameBooking = all.filter((x) => x.booking_id === p.booking_id && x.child_id === k.id).map((x) => x.camp_days.date).sort();
    const [{ data: entry }, pass, { data: late }] = await Promise.all([
      supabase.from("register_entries").select("signed_in_at, signed_out_at, collected_by").eq("camp_day_id", day.id).eq("child_id", k.id).maybeSingle(),
      ensurePass(db, day.id, k.id),
      supabase.from("late_notices").select("eta_minutes, created_at, acknowledged_at").eq("camp_day_id", day.id).eq("child_id", k.id).order("created_at", { ascending: false }).limit(1),
    ]);
    const age = ageOn(k.dob, date);
    children.push({
      id: k.id, firstName: k.first_name, lastName: k.last_name, age,
      group: day.camps.brand === "prime_camps" ? groups.find((g) => age >= g.min && age <= g.max)?.name ?? null : null,
      photoConsent: k.photo_consent, collectors: k.collectors,
      dayId: day.id, date, dayIndex: sameBooking.indexOf(date) + 1, dayCount: sameBooking.length,
      camp: {
        id: day.camps.id, school: day.camps.school,
        address: [day.camps.address, day.camps.area, day.camps.postcode].filter(Boolean).join(", ") || null,
        times: timeRange(day.camps.start_time, day.camps.end_time), endTime: day.camps.end_time, timetable: day.camps.timetable ?? [],
      },
      status: entry?.signed_out_at ? "out" : entry?.signed_in_at ? "in" : "not_arrived",
      signedInAt: entry?.signed_in_at ?? null, signedOutAt: entry?.signed_out_at ?? null, collectedBy: entry?.collected_by ?? null,
      pass,
      lateSent: late?.[0] ? { eta: late[0].eta_minutes, at: late[0].created_at, acknowledged: !!late[0].acknowledged_at } : null,
    });
  }

  const dayIds = [...new Set(children.map((c) => c.dayId))];
  const { data: notices } = dayIds.length
    ? await supabase.from("camp_posts").select("id, title, body, created_at").in("camp_day_id", dayIds).eq("kind", "notice").order("created_at", { ascending: false })
    : { data: [] };

  const future = all.filter((p) => p.camp_days.date > date).sort((a, b) => a.camp_days.date.localeCompare(b.camp_days.date));
  const next = future[0];
  return {
    date,
    children,
    notices: (notices ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, at: n.created_at })),
    nextCamp: next
      ? { school: next.camp_days.camps.school, date: next.camp_days.date, children: [...new Set(future.filter((f) => f.camp_days.date === next.camp_days.date).map((f) => kids!.find((k) => k.id === f.child_id)!.first_name))] }
      : null,
    allChildren: (kids ?? []).map((k) => ({ id: k.id, firstName: k.first_name })),
  };
}

async function ensurePass(db: ReturnType<typeof createAdminClient>, dayId: string, childId: string) {
  const { data: existing } = await db.from("pickup_passes").select("token, code, collector_name").eq("camp_day_id", dayId).eq("child_id", childId).maybeSingle();
  if (existing) return { token: existing.token, code: existing.code, collector: existing.collector_name };
  const row = { camp_day_id: dayId, child_id: childId, token: randomBytes(18).toString("base64url"), code: `PC-${randomInt(1000, 9999)}` };
  await db.from("pickup_passes").upsert(row, { onConflict: "camp_day_id,child_id", ignoreDuplicates: true });
  const { data } = await db.from("pickup_passes").select("token, code, collector_name").eq("camp_day_id", dayId).eq("child_id", childId).single();
  return { token: data!.token, code: data!.code, collector: data!.collector_name };
}
