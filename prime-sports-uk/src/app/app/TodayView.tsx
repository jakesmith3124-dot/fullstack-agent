"use client";
import Link from "next/link";
import type { TodayData } from "@/lib/parent-app";
import { KidHero } from "./KidHero";
import { useSelectedKid, useToday } from "./useToday";

function minutesNow() {
  const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return h * 60 + m;
}
function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  // Timetables are written like "2:30" for the afternoon.
  return (h < 7 ? h + 12 : h) * 60 + (m || 0);
}

export function TodayView({ initial }: { initial: TodayData }) {
  const { data, offline } = useToday(initial);
  const [kidId, setKid] = useSelectedKid(data.children.map((c) => c.id));
  const kid = data.children.find((c) => c.id === kidId);
  const now = minutesNow();
  const items = kid?.camp.timetable ?? [];
  const nowIdx = items.reduce((acc, [t], i) => (toMinutes(t) <= now ? i : acc), -1);

  return (
    <>
      {offline && <div className="offline">You&apos;re offline. Showing the last details we saved.</div>}
      <KidHero data={data} kid={kid} onPick={setKid} />
      <main className="pa-pad">
        {data.notices.map((n) => (
          <section key={n.id}><div className="alert"><b>{n.title}</b>{n.body && <span>{n.body}</span>}</div></section>
        ))}
        {kid && (
          <section>
            <div className="row" style={{ alignItems: "baseline" }}><h2>Today at camp</h2>{kid.dayCount > 1 && <span className="muted">Day {kid.dayIndex} of {kid.dayCount}</span>}</div>
            {items.length > 0 ? (
              <div className="card">
                <ol className="timeline">
                  {items.map(([t, a, b], i) => (
                    <li key={t + a} className={i < nowIdx ? "done" : i === nowIdx ? "now" : ""}>
                      <time>{t}</time>
                      <div><b>{a}</b>{i === nowIdx && <span className="now-tag">Now</span>}<span>{b}</span></div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="card"><p>{kid.camp.times} at {kid.camp.school}{kid.camp.address ? `, ${kid.camp.address}` : ""}.</p></div>
            )}
            <div className="hwbt-card"><b>HWBT</b><p>Hard Work Beats Talent. Effort, attitude and commitment come first.</p></div>
            <Link className="btn" href="/app/updates">See today&apos;s photos →</Link>
            <Link className="btn ghost" href="/app/pickup">Pickup pass</Link>
          </section>
        )}
        {!kid && (
          <section>
            <Link className="btn" href="/camps">Find a camp</Link>
            <Link className="btn ghost" href="/app/child">Your children&apos;s details</Link>
          </section>
        )}
      </main>
    </>
  );
}
