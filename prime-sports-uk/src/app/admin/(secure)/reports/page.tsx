import { requireOwner } from "@/lib/auth";
import { gbp, shortDay, todayLondon } from "@/lib/format";
import { addDays } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export default async function Reports({ searchParams }: PageProps<"/admin/reports">) {
  await requireOwner("/admin/reports");
  const sp = await searchParams;
  const today = todayLondon();
  const from = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDays(today, -30);
  const to = typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const supabase = await createClient();
  const [{ data: payments }, { data: bookings }, { data: days }, { data: camps }] = await Promise.all([
    supabase.from("payments").select("amount_pence, refunded_pence, created_at, booking_id, membership_id").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`),
    supabase.from("bookings").select("id, camp_id, status, total_pence, amount_paid_pence, amount_refunded_pence").in("status", ["confirmed", "cancelled"]),
    supabase.from("camp_days").select("id, date, capacity, camp_id").gte("date", addDays(today, -60)).order("date"),
    supabase.from("camps").select("id, school, area, is_demo"),
  ]);
  const campName = new Map((camps ?? []).map((c) => [c.id, `${c.school}${c.is_demo ? " (example)" : ""}`]));
  const bookingCamp = new Map((bookings ?? []).map((b) => [b.id, b.camp_id]));

  const byCamp = new Map<string, { bookings: number; cancelled: number; booked: number; paid: number; refunded: number }>();
  for (const b of bookings ?? []) {
    const r = byCamp.get(b.camp_id) ?? { bookings: 0, cancelled: 0, booked: 0, paid: 0, refunded: 0 };
    if (b.status === "confirmed") { r.bookings++; r.booked += b.total_pence; } else r.cancelled++;
    r.paid += b.amount_paid_pence;
    r.refunded += b.amount_refunded_pence;
    byCamp.set(b.camp_id, r);
  }
  const byDate = new Map<string, number>();
  let periodNet = 0;
  for (const p of payments ?? []) {
    const d = new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    byDate.set(d, (byDate.get(d) ?? 0) + p.amount_pence - p.refunded_pence);
    periodNet += p.amount_pence - p.refunded_pence;
  }
  const occupancy = await Promise.all(
    (days ?? []).filter((d) => d.date >= addDays(today, -14)).map(async (d) => {
      const { data } = await supabase.rpc("day_taken", { p_day: d.id });
      return { ...d, taken: (data as number) ?? 0 };
    }),
  );
  void bookingCamp;

  return (
    <>
      <h1 className="admin-title">Reports</h1>
      <form className="toolbar card" method="get">
        <label className="field">From<input type="date" name="from" defaultValue={from} /></label>
        <label className="field">To<input type="date" name="to" defaultValue={to} /></label>
        <button className="btn small">Update</button>
        <p className="muted">Money taken in this period, after refunds: <b>{gbp(periodNet)}</b></p>
      </form>
      <div className="card table-wrap">
        <h2>Revenue by camp (all time)</h2>
        <table>
          <thead><tr><th>Camp</th><th>Bookings</th><th>Cancelled</th><th>Booked value</th><th>Paid</th><th>Refunded</th><th>Still to collect</th></tr></thead>
          <tbody>
            {[...byCamp.entries()].map(([id, r]) => (
              <tr key={id}><td>{campName.get(id)}</td><td>{r.bookings}</td><td>{r.cancelled}</td><td>{gbp(r.booked)}</td><td>{gbp(r.paid)}</td><td>{gbp(r.refunded)}</td><td>{gbp(Math.max(0, r.booked - (r.paid - r.refunded)))}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrap">
        <h2>Money taken by date</h2>
        {byDate.size ? (
          <table><thead><tr><th>Date</th><th>Net taken</th></tr></thead>
            <tbody>{[...byDate.entries()].sort().reverse().map(([d, v]) => <tr key={d}><td>{shortDay(d)}</td><td>{gbp(v)}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted">No payments in this period.</p>}
      </div>
      <div className="card table-wrap">
        <h2>Occupancy per day</h2>
        <table>
          <thead><tr><th>Day</th><th>Camp</th><th>Booked</th><th style={{ width: "35%" }}></th></tr></thead>
          <tbody>
            {occupancy.map((d) => {
              const pct = d.capacity ? Math.min(100, Math.round((d.taken / d.capacity) * 100)) : 100;
              return (
                <tr key={d.id}>
                  <td>{shortDay(d.date)}</td><td>{campName.get(d.camp_id)}</td><td>{d.taken} / {d.capacity}</td>
                  <td><div className={`bar${pct >= 100 ? " full" : ""}`} role="img" aria-label={`${pct}% full`}><span style={{ width: `${pct}%` }} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
