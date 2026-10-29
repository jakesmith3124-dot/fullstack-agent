import { offerWaitingSpace, setWaitingStatus } from "@/app/actions/admin-bookings";
import { requireOwner } from "@/lib/auth";
import { fmtDateTime, shortDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function WaitingLists() {
  await requireOwner("/admin/waiting-lists");
  const supabase = await createClient();
  const { data } = await supabase
    .from("waiting_list")
    .select("id, parent_name, parent_email, parent_phone, children_count, status, offered_at, created_at, camp_days(date, capacity, camps(school))")
    .in("status", ["waiting", "offered"])
    .order("created_at");
  const rows = (data ?? []) as unknown as { id: string; parent_name: string; parent_email: string; parent_phone: string | null; children_count: number; status: string; offered_at: string | null; created_at: string; camp_days: { date: string; capacity: number; camps: { school: string } } }[];
  return (
    <>
      <h1 className="admin-title">Waiting lists</h1>
      <p className="muted">When you cancel a booking, the first family waiting on each freed day is emailed automatically. You can also offer a space yourself, for example after raising a day&apos;s capacity.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Day</th><th>Parent</th><th>Children</th><th>Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{shortDay(r.camp_days.date)}<br /><span className="muted">{r.camp_days.camps.school}</span></td>
                <td>{r.parent_name}<br /><a href={`mailto:${r.parent_email}`}>{r.parent_email}</a>{r.parent_phone && <><br />{r.parent_phone}</>}</td>
                <td>{r.children_count}</td>
                <td>{fmtDateTime(r.created_at)}</td>
                <td>{r.status === "offered" ? `Offered ${fmtDateTime(r.offered_at!)}` : "Waiting"}</td>
                <td>
                  <div className="actions">
                    <form action={offerWaitingSpace.bind(null, r.id)}><button className="btn small">{r.status === "offered" ? "Offer again" : "Offer space"}</button></form>
                    <form action={setWaitingStatus.bind(null, r.id, "booked")}><button className="btn small ghost">Booked</button></form>
                    <form action={setWaitingStatus.bind(null, r.id, "removed")}><button className="btn small ghost">Remove</button></form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted">Nobody is waiting.</p>}
      </div>
    </>
  );
}
