import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { dateRange, fmtDateTime, gbp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string; ref: string; status: string; plan: string; total_pence: number; amount_paid_pence: number; amount_refunded_pence: number;
  parent_name: string; parent_email: string; created_at: string; flagged_unpaid: boolean; over_capacity: boolean;
  camps: { school: string }; booking_places: { camp_days: { date: string } }[]; instalments: { status: string }[];
};

export default async function BookingsAdmin({ searchParams }: PageProps<"/admin/bookings">) {
  await requireOwner("/admin/bookings");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const camp = typeof sp.camp === "string" ? sp.camp : "";
  const status = typeof sp.status === "string" ? sp.status : "confirmed";
  const filter = typeof sp.filter === "string" ? sp.filter : "";
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select("id, ref, status, plan, total_pence, amount_paid_pence, amount_refunded_pence, parent_name, parent_email, created_at, flagged_unpaid, over_capacity, camps(school), booking_places(camp_days(date)), instalments(status)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status !== "all") query = query.eq("status", status);
  if (camp) query = query.eq("camp_id", camp);
  if (filter === "unpaid") query = query.eq("flagged_unpaid", true);
  if (q) query = query.or(`ref.ilike.%${q.replace(/[%,()]/g, "")}%,parent_name.ilike.%${q.replace(/[%,()]/g, "")}%,parent_email.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data }, { data: camps }] = await Promise.all([query, supabase.from("camps").select("id, school, area").order("sort_order")]);
  let rows = (data ?? []) as unknown as Row[];
  if (filter === "failed") rows = rows.filter((r) => r.instalments.some((i) => i.status === "failed"));

  return (
    <>
      <h1 className="admin-title">Bookings</h1>
      <form className="toolbar card" method="get">
        <label className="field">Search<input name="q" defaultValue={q} placeholder="Reference, name or email" /></label>
        <label className="field">Camp
          <select name="camp" defaultValue={camp}><option value="">All camps</option>{(camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.school} ({c.area})</option>)}</select>
        </label>
        <label className="field">Status
          <select name="status" defaultValue={status}><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="pending">In checkout</option><option value="expired">Abandoned</option><option value="all">All</option></select>
        </label>
        <label className="field">Show
          <select name="filter" defaultValue={filter}><option value="">Everything</option><option value="failed">Failed instalments</option><option value="unpaid">Unpaid before camp</option></select>
        </label>
        <button className="btn small" type="submit">Filter</button>
      </form>
      <p className="muted">{rows.length} booking{rows.length === 1 ? "" : "s"}</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Parent</th><th>Camp</th><th>Days</th><th>Paid</th><th>Booked</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/bookings/${r.id}`}><b>{r.ref}</b></Link></td>
                <td>{r.parent_name}<br /><span className="muted">{r.parent_email}</span></td>
                <td>{r.camps.school}</td>
                <td>{dateRange([...new Set(r.booking_places.map((p) => p.camp_days.date))])}</td>
                <td>{gbp(r.amount_paid_pence - r.amount_refunded_pence)} / {gbp(r.total_pence)}{r.plan === "instalments" && <><br /><span className="tag ph">Instalments</span></>}</td>
                <td>{fmtDateTime(r.created_at)}</td>
                <td>
                  {r.instalments.some((i) => i.status === "failed") && <span className="tag med">Failed payment</span>}
                  {r.flagged_unpaid && <span className="tag med">Unpaid</span>}
                  {r.over_capacity && <span className="tag med">Over capacity</span>}
                  {r.status !== "confirmed" && <span className="tag ph">{r.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
