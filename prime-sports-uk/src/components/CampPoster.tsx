import { fmtDate } from "@/lib/format";
import type { CampKind } from "@/lib/types";

/**
 * Branded artwork for camps without a photo yet: a pitch (camps), a court (clubs) or a dartboard (darts),
 * with the dates big enough to read from a phone. Each venue gets its own angle so cards don't look identical.
 */
export function CampPoster({ kind = "camp", slug, area, dates, ageMin, ageMax }: {
  kind?: CampKind; slug: string; area: string; dates: string[]; ageMin: number; ageMax: number;
}) {
  const seed = [...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const tilt = (seed % 13) - 6;
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let big = "Dates soon";
  let small = "";
  if (first && (kind === "club" || kind === "darts")) {
    big = `${fmtDate(first, { weekday: "long" })}s`;
    small = `From ${fmtDate(first, { day: "numeric", month: "short" })}`;
  } else if (first) {
    const sameMonth = first.slice(0, 7) === last.slice(0, 7);
    big = first === last
      ? fmtDate(first, { day: "numeric", month: "short" })
      : `${fmtDate(first, { day: "numeric", ...(sameMonth ? {} : { month: "short" }) })}–${fmtDate(last, { day: "numeric", month: "short" })}`;
    small = fmtDate(first, { weekday: "short" }) + (first === last ? "" : ` to ${fmtDate(last, { weekday: "short" })}`);
  }
  const label = kind === "club" ? "School club" : kind === "darts" ? "Darts" : "Holiday camp";

  return (
    <div className={`poster poster-${kind}`} aria-hidden="true">
      <svg className="poster-art" viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" style={{ transform: `rotate(${tilt}deg) scale(1.25)` }}>
        {kind === "darts" ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.2" transform="translate(118 58)">
            {[46, 36, 26, 16, 7, 2.5].map((r) => <circle key={r} r={r} />)}
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i * Math.PI) / 10;
              return <line key={i} x1={-46 * Math.cos(a)} y1={-46 * Math.sin(a)} x2={46 * Math.cos(a)} y2={46 * Math.sin(a)} />;
            })}
          </g>
        ) : kind === "club" ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="12" y="10" width="136" height="90" rx="2" />
            <line x1="80" y1="10" x2="80" y2="100" />
            <circle cx="80" cy="55" r="14" />
            <path d="M12 30 h22 a25 25 0 0 1 0 50 h-22 M148 30 h-22 a25 25 0 0 0 0 50 h22" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            {Array.from({ length: 8 }, (_, i) => <rect key={i} x={i * 20} y="0" width="10" height="110" fill="currentColor" opacity="0.06" stroke="none" />)}
            <rect x="10" y="8" width="140" height="94" />
            <line x1="80" y1="8" x2="80" y2="102" />
            <circle cx="80" cy="55" r="16" />
            <rect x="10" y="33" width="22" height="44" />
            <rect x="128" y="33" width="22" height="44" />
          </g>
        )}
      </svg>
      <div className="poster-text">
        <span className="poster-kind">{label} · {area}</span>
        <span className="poster-big">{big}</span>
        <span className="poster-small">{[small, `Ages ${ageMin}–${ageMax}`].filter(Boolean).join(" · ")}</span>
      </div>
    </div>
  );
}
