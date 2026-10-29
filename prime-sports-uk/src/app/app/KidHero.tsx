"use client";
import { fmtClock, longDate } from "@/lib/format";
import type { TodayChild, TodayData } from "@/lib/parent-app";

export function KidHero({ data, kid, onPick }: { data: TodayData; kid: TodayChild | undefined; onPick: (id: string) => void }) {
  return (
    <div className="pa-hero">
      <div className="pa-pad">
        {data.children.length > 1 && (
          <div className="kid-switch" role="group" aria-label="Choose a child">
            {data.children.map((c) => (
              <button key={c.id} type="button" className="kid-btn" aria-pressed={c.id === kid?.id} onClick={() => onPick(c.id)}>{c.firstName}</button>
            ))}
          </div>
        )}
        {kid ? (
          <>
            <h1>{kid.firstName} {kid.status === "in" ? "is checked in" : kid.status === "out" ? "has been collected" : "isn't signed in yet"}</h1>
            <div className="status" role="status" aria-live="polite">
              <span className={`live${kid.status === "in" ? " in" : kid.status === "out" ? " out" : ""}`} aria-hidden="true" />
              <div>
                <b>{kid.status === "in" ? `Arrived ${fmtClock(kid.signedInAt!)}` : kid.status === "out" ? `Collected by ${kid.collectedBy} at ${fmtClock(kid.signedOutAt!)}` : `Camp runs ${kid.camp.times}`}</b>
                <small>{kid.camp.school}{kid.group ? ` · ${kid.group}` : ""}</small>
              </div>
            </div>
          </>
        ) : (
          <>
            <h1>No camp today</h1>
            <p>{data.nextCamp ? `Next up: ${data.nextCamp.children.join(" and ")} at ${data.nextCamp.school} on ${longDate(data.nextCamp.date)}.` : "When your children are booked on a camp, today's details and pickup passes appear here."}</p>
          </>
        )}
      </div>
    </div>
  );
}
