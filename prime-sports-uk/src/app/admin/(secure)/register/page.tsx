import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { shortDay, timeRange, todayLondon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterList() {
  const viewer = await requireStaff("/admin/register");
  const supabase = await createClient();
  const today = todayLondon();
  // RLS limits staff to their assigned sessions; owners see every camp day.
  const { data } = await supabase
    .from("camp_days")
    .select("id, date, capacity, camp_id, camps(school, area, start_time, end_time, is_demo)")
    .gte("date", today)
    .order("date")
    .limit(60);
  const days = (data ?? []) as unknown as { id: string; date: string; capacity: number; camp_id: string; camps: { school: string; area: string; start_time: string; end_time: string; is_demo: boolean } }[];
  // Public camp days are readable by anyone, so filter staff down to their own assignments.
  const { data: mine } = await supabase.from("staff_assignments").select("camp_id, camp_day_id").eq("staff_id", viewer.id);
  const visible = viewer.role === "owner" ? days : days.filter((d) => (mine ?? []).some((a) => a.camp_id === d.camp_id && (!a.camp_day_id || a.camp_day_id === d.id)));
  return (
    <>
      <h1 className="admin-title">{viewer.role === "owner" ? "Registers" : "My registers"}</h1>
      {!visible.length && <p className="muted">{viewer.role === "owner" ? "No upcoming camp days." : "You haven't been assigned to any upcoming sessions yet."}</p>}
      <div className="acc-grid">
        {visible.map((d) => (
          <Link key={d.id} href={`/admin/register/${d.id}`} className="card" style={{ textDecoration: "none" }}>
            <span className="area-tag">{d.date === today ? "Today" : shortDay(d.date)}</span>
            <h2 style={{ fontSize: "1.4rem" }}>{d.camps.school}{d.camps.is_demo ? " (example)" : ""}</h2>
            <p className="muted">{d.camps.area} · {timeRange(d.camps.start_time, d.camps.end_time)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
