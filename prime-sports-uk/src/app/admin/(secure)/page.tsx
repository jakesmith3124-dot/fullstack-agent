import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { gbp, shortDay, todayLondon } from "@/lib/format";
import { addDays } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  await requireOwner("/admin");
  const supabase = await createClient();
  const today = todayLondon();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [bookings, payments, failed, flagged, over, unconfirmed, waiting, ea, goat, schools, contact, days, settings] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("confirmed_at", `${today}T00:00:00`),
    supabase.from("payments").select("amount_pence, refunded_pence").gte("created_at", `${monthStart}T00:00:00`),
    supabase.from("instalments").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("bookings").select("id, ref, parent_name").eq("flagged_unpaid", true).eq("status", "confirmed"),
    supabase.from("bookings").select("id, ref").eq("over_capacity", true).eq("status", "confirmed"),
    supabase.from("content_items").select("key, tbc_note, section").eq("confirmed", false),
    supabase.from("waiting_list").select("id", { count: "exact", head: true }).eq("status", "waiting"),
    supabase.from("early_access_signups").select("id", { count: "exact", head: true }),
    supabase.from("goat_waitlist").select("id", { count: "exact", head: true }),
    supabase.from("school_enquiries").select("id", { count: "exact", head: true }),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }),
    supabase.from("camp_days").select("id, date, capacity, camps(school, is_demo)").gte("date", today).lte("date", addDays(today, 7)).order("date"),
    supabase.from("settings").select("key, label, confirmed").eq("confirmed", false),
  ]);
  const revenue = (payments.data ?? []).reduce((s, p) => s + p.amount_pence - p.refunded_pence, 0);
  const thisWeek = (days.data ?? []) as unknown as { id: string; date: string; capacity: number; camps: { school: string; is_demo: boolean } }[];
  const todo = [...(unconfirmed.data ?? []).map((c) => ({ label: c.tbc_note || c.key, href: `/admin/content#${c.key}` })), ...(settings.data ?? []).map((s) => ({ label: s.label || s.key, href: "/admin/settings" }))];

  return (
    <>
      <h1 className="admin-title">Dashboard</h1>
      <div className="stat-grid">
        <Link className="stat" href="/admin/bookings"><b>{bookings.count ?? 0}</b><span>Bookings today</span></Link>
        <Link className="stat" href="/admin/reports"><b>{gbp(revenue)}</b><span>Taken this month</span></Link>
        <Link className={`stat${failed.count ? " warn" : ""}`} href="/admin/bookings?filter=failed"><b>{failed.count ?? 0}</b><span>Failed instalments</span></Link>
        <Link className={`stat${flagged.data?.length ? " warn" : ""}`} href="/admin/bookings?filter=unpaid"><b>{flagged.data?.length ?? 0}</b><span>Unpaid before camp</span></Link>
        <Link className="stat" href="/admin/waiting-lists"><b>{waiting.count ?? 0}</b><span>On waiting lists</span></Link>
        <Link className="stat" href="/admin/leads"><b>{ea.count ?? 0}</b><span>Prime Camps early access</span></Link>
        <Link className="stat" href="/admin/leads?tab=goat"><b>{goat.count ?? 0}</b><span>G.O.A.T waiting list</span></Link>
        <Link className="stat" href="/admin/leads?tab=schools"><b>{(schools.count ?? 0) + (contact.count ?? 0)}</b><span>School enquiries and messages</span></Link>
      </div>

      {(over.data?.length ?? 0) > 0 && (
        <div className="card unconfirmed">
          <h2>Over capacity</h2>
          <p>These bookings were paid after their hold ran out and another family took the space. Check numbers with your staff.</p>
          <ul>{over.data!.map((b) => <li key={b.id}><Link href={`/admin/bookings/${b.id}`}>{b.ref}</Link></li>)}</ul>
        </div>
      )}

      <div className="card">
        <div className="row"><h2>Camp days this week</h2><Link href="/admin/register">Open registers →</Link></div>
        {thisWeek.length ? (
          <ul className="day-list">{thisWeek.map((d) => <li key={d.id}><span>{shortDay(d.date)} · {d.camps.school}{d.camps.is_demo ? " (example)" : ""}</span><Link href={`/admin/register/${d.id}`}>Register</Link></li>)}</ul>
        ) : <p className="muted">No camp days in the next week.</p>}
      </div>

      <div className="card">
        <h2>Before launch: things to confirm ({todo.length})</h2>
        <p className="muted">These are hidden from the public site until you confirm them. Unconfirmed items show in orange throughout admin.</p>
        <ul>{todo.map((t, i) => <li key={i}><Link href={t.href}>{t.label}</Link></li>)}</ul>
      </div>
    </>
  );
}
