import Link from "next/link";
import { moveCamp, setCampFlag } from "@/app/actions/admin-camps";
import { requireOwner } from "@/lib/auth";
import { dateRange, gbp, todayLondon } from "@/lib/format";
import { kindWords } from "@/lib/camp-kind";
import { createClient } from "@/lib/supabase/server";
import type { CampKind } from "@/lib/types";

const TABS: { kind: CampKind; label: string; add: string }[] = [
  { kind: "camp", label: "Holiday camps", add: "+ Add a holiday camp" },
  { kind: "club", label: "School clubs", add: "+ Add a school club" },
  { kind: "darts", label: "Darts", add: "+ Add darts sessions" },
];

export default async function CampsAdmin({ searchParams }: PageProps<"/admin/camps">) {
  await requireOwner("/admin/camps");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.kind === sp.type) ?? TABS[0];
  const w = kindWords(tab.kind);
  const supabase = await createClient();
  const { data } = await supabase.from("camps").select("id, slug, school, area, price_per_day_pence, is_visible, confirmed, is_demo, brand, kind, camp_days(date)").order("sort_order").order("school");
  const today = todayLondon();
  const all = (data ?? []) as unknown as { id: string; slug: string; school: string; area: string; price_per_day_pence: number; is_visible: boolean; confirmed: boolean; is_demo: boolean; brand: string; kind: CampKind | null; camp_days: { date: string }[] }[];
  const camps = all.filter((c) => (c.kind ?? "camp") === tab.kind);
  return (
    <>
      <div className="row"><h1 className="admin-title">Camps, clubs and darts</h1><Link className="btn" href={`/admin/camps/new?kind=${tab.kind}`}>{tab.add}</Link></div>
      <div className="chips" style={{ marginBottom: "1rem" }}>
        {TABS.map((t) => (
          <Link key={t.kind} className="chip" aria-pressed={t.kind === tab.kind} href={`/admin/camps?type=${t.kind}`}>
            {t.label} ({all.filter((c) => (c.kind ?? "camp") === t.kind).length})
          </Link>
        ))}
      </div>
      <p className="muted">Lower in the list shows later on the site. They only appear publicly when they are both <b>visible</b> and <b>confirmed</b>, and have {w.units} from today onwards.{w.weekly ? " Parents can book single weeks or the whole term." : ""}</p>
      {camps.length === 0 && <p className="muted">Nothing here yet.</p>}
      <div style={{ display: "grid", gap: ".8rem" }}>
        {camps.map((c, i) => {
          const dates = c.camp_days.map((d) => d.date);
          const past = dates.every((d) => d < today);
          return (
            <div key={c.id} className={`card${c.confirmed ? "" : " unconfirmed"}`} style={{ gap: ".5rem" }}>
              <div className="row">
                <div>
                  <h2 style={{ fontSize: "1.3rem" }}><Link href={`/admin/camps/${c.id}`}>{c.school}</Link></h2>
                  <p className="muted">{c.area} · {dates.length ? dateRange(dates) : "No days yet"} · {gbp(c.price_per_day_pence)}/{w.unit}{c.brand === "prime_camps" ? " · Prime Camps" : c.brand === "prime_darts" ? " · Prime Sports Darts" : ""}</p>
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
