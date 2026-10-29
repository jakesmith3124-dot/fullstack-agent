// Load test for booking day: fires many simultaneous holds at one camp day and checks that the
// number of places taken never goes over capacity. Usage (local only):
//   node --env-file=.env.local --import tsx scripts/capacity-race.mts [parallel=60] [capacity=5]
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1")) throw new Error("Run this against a local database only.");
const parallel = Number(process.argv[2] ?? 60);
const capacity = Number(process.argv[3] ?? 5);

const { data: camp } = await db.from("camps").insert({ slug: `race-${Date.now()}`, school: "Race Test", area: "Test", age_min: 4, age_max: 11, price_per_day_pence: 1000, confirmed: false, is_visible: false, is_demo: true }).select("id").single();
const { data: day } = await db.from("camp_days").insert({ camp_id: camp!.id, date: "2030-01-01", capacity }).select("id").single();
const parents = await Promise.all(Array.from({ length: parallel }, async (_, i) => {
  const { data } = await db.auth.admin.createUser({ email: `race-${Date.now()}-${i}@example.com`, email_confirm: true });
  const { data: child } = await db.from("children").insert({ parent_id: data.user!.id, first_name: "Race", last_name: String(i), dob: "2018-01-01" }).select("id").single();
  return { parent: data.user!.id, child: child!.id };
}));

const started = Date.now();
const results = await Promise.allSettled(parents.map((p) => db.rpc("create_booking_hold", { p: {
  camp_id: camp!.id, parent_id: p.parent, day_ids: [day!.id], child_ids: [p.child], lines: [{ child_id: p.child, line_total_pence: 1000 }],
  plan: "full", instalment_count: 1, subtotal_pence: 1000, sibling_discount_pence: 0, code_discount_pence: 0, total_pence: 1000,
  discount_code_id: "", parent_name: "Race", parent_email: "race@example.com", parent_phone: "0", emergency_name: "E", emergency_phone: "0", emergency_relationship: "",
} }).then((r) => { if (r.error) throw r.error; return r.data; })));
const ok = results.filter((r) => r.status === "fulfilled").length;
const full = results.filter((r) => r.status === "rejected" && String((r.reason as Error).message).includes("DAY_FULL")).length;
const { data: taken } = await db.rpc("day_taken", { p_day: day!.id });
console.log(`${parallel} parents raced for ${capacity} places in ${Date.now() - started} ms: ${ok} held, ${full} told the day is full, ${taken} places taken.`);
await db.from("bookings").delete().eq("camp_id", camp!.id);
await db.from("camps").delete().eq("id", camp!.id);
if (taken !== capacity || ok !== capacity) { console.error("✗ Capacity was not enforced correctly"); process.exit(1); }
console.log("✓ Capacity held under load");
