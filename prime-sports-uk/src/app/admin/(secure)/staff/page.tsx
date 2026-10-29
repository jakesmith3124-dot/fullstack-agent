import { removeAssignment, setRole } from "@/app/actions/admin-staff";
import { requireOwner } from "@/lib/auth";
import { shortDay, todayLondon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AddStaffForm, AssignForm } from "./StaffForms";

export default async function StaffPage() {
  const viewer = await requireOwner("/admin/staff");
  const supabase = await createClient();
  const today = todayLondon();
  const [{ data: staff }, { data: assignments }, { data: camps }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").in("role", ["owner", "staff"]).order("role").order("email"),
    supabase.from("staff_assignments").select("id, staff_id, camp_day_id, camps(school), camp_days(date)"),
    supabase.from("camps").select("id, school, area, camp_days(id, date)").order("sort_order"),
  ]);
  const campOptions = (camps ?? []).map((c) => ({
    id: c.id, label: `${c.school} (${c.area})`,
    days: ((c.camp_days ?? []) as { id: string; date: string }[]).filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ id: d.id, label: shortDay(d.date) })),
  }));
  return (
    <>
      <h1 className="admin-title">Staff</h1>
      <p className="muted">Staff see only the registers for the sessions you assign them to. Everyone with a staff or owner account must use two-step sign-in.</p>
      <AddStaffForm />
      {(staff ?? []).map((s) => {
        const mine = ((assignments ?? []) as unknown as { id: string; staff_id: string; camp_day_id: string | null; camps: { school: string }; camp_days: { date: string } | null }[]).filter((a) => a.staff_id === s.id);
        return (
          <div className="card" key={s.id}>
            <div className="row">
              <div><h2 style={{ fontSize: "1.3rem" }}>{s.full_name || s.email}</h2><p className="muted">{s.email} · {s.role}</p></div>
              {s.id !== viewer.id && (
                <div className="actions">
                  {s.role === "staff" && <form action={setRole.bind(null, s.id, "owner")}><button className="btn small ghost">Make owner</button></form>}
                  {s.role === "owner" && <form action={setRole.bind(null, s.id, "staff")}><button className="btn small ghost">Make staff</button></form>}
                  <form action={setRole.bind(null, s.id, "parent")}><button className="btn small ghost" style={{ color: "var(--bad)" }}>Remove access</button></form>
                </div>
              )}
            </div>
            {s.role === "staff" && (
              <>
                <h3>Assigned sessions</h3>
                {mine.length ? (
                  <ul className="day-list">{mine.map((a) => <li key={a.id}><span>{a.camps.school} · {a.camp_days ? shortDay(a.camp_days.date) : "every day"}</span><form action={removeAssignment.bind(null, a.id)}><button className="link">Remove</button></form></li>)}</ul>
                ) : <p className="muted">Not assigned to any sessions yet.</p>}
                <AssignForm staffId={s.id} camps={campOptions} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
