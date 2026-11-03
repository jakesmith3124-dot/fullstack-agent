"use client";
import Link from "next/link";
import { useState } from "react";
import { kindWords } from "@/lib/camp-kind";
import { fmtDate, gbp } from "@/lib/format";
import { quote, spaceLevel, spacesLeft } from "@/lib/pricing";
import type { CampDay, CampKind } from "@/lib/types";

/**
 * Pick days straight from the camp page with a live price, then carry them into the booking.
 * On phones the total and the button stay pinned to the bottom of the screen.
 */
export function DayPicker({ slug, kind, days, pricePerDayPence, fullWeekPricePence, totalDays }: {
  slug: string; kind: CampKind; days: CampDay[]; pricePerDayPence: number; fullWeekPricePence: number | null; totalDays: number;
}) {
  const w = kindWords(kind);
  const open = days.filter((d) => spacesLeft(d) > 0);
  const [picked, setPicked] = useState<string[]>([]);
  const q = quote({ pricePerDayPence, fullWeekPricePence, campDayCount: totalDays, selectedDayCount: picked.length, childCount: 1, siblingPct: 0 });
  const allPicked = open.length > 0 && picked.length === open.length;
  const saving = q.usesFullWeekPrice ? pricePerDayPence * picked.length - q.perChildPence : 0;
  const href = `/book/${slug}${picked.length ? `?days=${picked.join(",")}` : ""}`;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="dp">
      <div className="row">
        <h2 className="h3-size">Pick your {w.units}</h2>
        {open.length > 1 && (
          <button type="button" className="link" onClick={() => setPicked(allPicked ? [] : open.map((d) => d.day_id))}>
            {allPicked ? "Clear" : w.weekly ? "Whole term" : "Whole week"}
          </button>
        )}
      </div>
      <div className="days" role="group" aria-label={`Choose ${w.units}`}>
        {days.map((d) => {
          const left = spacesLeft(d);
          const on = picked.includes(d.day_id);
          return (
            <button key={d.day_id} type="button" className="day" aria-pressed={on} disabled={left <= 0} onClick={() => toggle(d.day_id)}
              aria-label={`${fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })}, ${left <= 0 ? "full" : `${left} spaces left`}`}>
              <span className="dw">{fmtDate(d.date, w.weekly ? { month: "short" } : { weekday: "short" })}</span>
              <span className="dn">{fmtDate(d.date, { day: "numeric" })}</span>
              <span className={`sp ${spaceLevel(d)}`}>{left <= 0 ? "Full" : `${left} left`}</span>
            </button>
          );
        })}
      </div>
      {fullWeekPricePence && !q.usesFullWeekPrice && open.length === totalDays && (
        <p className="hint">Book every {w.unit} for {gbp(fullWeekPricePence)} instead of {gbp(pricePerDayPence * totalDays)}.</p>
      )}
      <div className={`dp-bar${picked.length ? " on" : ""}`}>
        <div className="dp-sum" aria-live="polite">
          {picked.length ? (
            <>
              <b>{gbp(q.perChildPence)}</b>
              <span>{picked.length} {picked.length === 1 ? w.unit : w.units} · per child{saving > 0 ? ` · you save ${gbp(saving)}` : ""}</span>
            </>
          ) : (
            <span>Tap the {w.units} you&apos;d like</span>
          )}
        </div>
        <Link className="btn" href={href} aria-disabled={!picked.length} onClick={(e) => { if (!picked.length) e.preventDefault(); }}>
          Book {picked.length ? "these" : ""} {w.units} →
        </Link>
      </div>
    </div>
  );
}
