import type { FillStatus } from "@/lib/pricing";

/** Ribbons over the camp image: the owner's badge (e.g. Premium) and how full it is. */
export function CampRibbons({ badge, fill }: { badge?: string | null; fill: FillStatus }) {
  if (!badge && !fill.label) return null;
  return (
    <div className="ribbons">
      {badge && <span className={`ribbon${/premium|elite/i.test(badge) ? " premium" : ""}`}>{/premium|elite/i.test(badge) && <b aria-hidden="true">★ </b>}{badge}</span>}
      {fill.label && <span className={`ribbon ${fill.level}`}>{fill.level !== "sold_out" && <i className="pulse" aria-hidden="true" />}{fill.label}</span>}
    </div>
  );
}

/** "18 of 30 places booked" bar, shown once a camp is at least a quarter full. */
export function FillBar({ fill, unit }: { fill: FillStatus; unit: string }) {
  if (fill.pct < 25 || fill.level === "sold_out") return null;
  return (
    <div className={`fillbar ${fill.level ?? ""}`}>
      <div className="fillbar-track" role="img" aria-label={`${fill.pct}% of places booked`}><span style={{ width: `${fill.pct}%` }} /></div>
      <p>
        <b>{fill.pct}% booked</b>
        {fill.placesLeft <= 15 ? ` · only ${fill.placesLeft} ${fill.placesLeft === 1 ? "place" : "places"} left across all ${unit}s` : ""}
      </p>
    </div>
  );
}
