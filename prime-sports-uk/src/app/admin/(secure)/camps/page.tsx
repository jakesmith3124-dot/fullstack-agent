import Link from "next/link";
import { moveCamp, setCampFlag } from "@/app/actions/admin-camps";
import { requireOwner } from "@/lib/auth";
import { dateRange, gbp, todayLondon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function CampsAdmin() {
  await requireOwner("/admin/camps");
  const supabase = await createClient();
  const { data } = await supabase.from("camps").select("id, slug, school, area, price_per_day_pence, is_visible, confirmed, is_demo, brand, camp_days(date)").order("sort_order").order("school");
  const today = todayLondon();
  const camps = (data ?? []) as unknown as { id: string; slug: string; school: string; area: string; price_per_day_pence: number; is_visible: boolean; confirmed: boolean; is_demo: boolean; brand: string; camp_days: { date: string }[] }[];
  return (
    <>
      <div className="row"><h1 className="admin-title">Camps</h1><Link className="btn" href="/admin/camps/new">+ Add a camp</Link></div>
      <p className="muted">Lower in the list shows later on the site. Camps only appear publicly when they are both <b>visible</b> and <b>confirmed</b>, and have days from today onwards.</p>
      <div style={{ display: "grid", gap: ".8rem" }}>
        {camps.map((c, i) => {
          const dates = c.camp_days.map((d) => d.date);
          const past = dates.every((d) => d < today);
          return (
            <div key={c.id} className={`card${c.confirmed ? "" : " unconfirmed"}`} style={{ gap: ".5rem" }}>
              <div className="row">
                <div>
                  <h2 style={{ fontSize: "1.3rem" }}><Link href={`/admin/camps/${c.id}`}>{c.school}</Link></h2>
                  <p className="muted">{c.area} · {dates.length ? dateRange(dates) : "No days yet"} · {gbp(c.price_per_day_pence)}/day{c.brand === "prime_camps" ? " · Prime Camps" : ""}</p>
                </div>
                <div className="chips">
                  {c.is_demo && <span className="tag ph">Example</span>}
                  {past && <span className="tag">Finished</span>}
                  {!c.confirmed && <span className="badge-tbc">To confirm</span>}
                  {!c.is_visible && <span className="tag ph">Hidden</span>}
                </div>
              </div>
              <div className="actions">
                <form action={moveCamp.bind(null, c.id, -1)}><button className="btn small ghost" disabled={i === 0} aria-label={`Move ${c.school} up`}>↑</button></form>
                <form action={moveCamp.bind(null, c.id, 1)}><button className="btn small ghost" disabled={i === camps.length - 1} aria-label={`Move ${c.school} down`}>↓</button></form>
                <form action={setCampFlag.bind(null, c.id, "is_visible", !c.is_visible)}><button className="btn small ghost">{c.is_visible ? "Hide" : "Show"}</button></form>
                <form action={setCampFlag.bind(null, c.id, "confirmed", !c.confirmed)}><button className="btn small ghost">{c.confirmed ? "Mark unconfirmed" : "Confirm"}</button></form>
                <Link className="btn small" href={`/admin/camps/${c.id}`}>Edit</Link>
                <Link className="btn small ghost" href={`/camps/${c.slug}`} target="_blank">View</Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
