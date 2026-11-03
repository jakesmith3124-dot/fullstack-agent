"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CampKind } from "@/lib/types";

export type FinderItem = { kind: CampKind; area: string; age_min: number; age_max: number; full: boolean };

const KINDS: { kind: CampKind; label: string; path: string }[] = [
  { kind: "camp", label: "Holiday camps", path: "/camps" },
  { kind: "club", label: "School clubs", path: "/clubs" },
  { kind: "darts", label: "Darts", path: "/clubs" },
];
const AGES = Array.from({ length: 13 }, (_, i) => i + 4);

/** The home page's first question: what's on for my child? Counts live matches as they choose. */
export function HeroFinder({ items }: { items: FinderItem[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<CampKind>("camp");
  const [age, setAge] = useState<number | null>(null);
  const [area, setArea] = useState("");
  const areas = useMemo(() => [...new Set(items.filter((i) => i.kind === kind).map((i) => i.area))].sort(), [items, kind]);
  const matches = items.filter((i) => i.kind === kind && (!area || i.area === area) && (age === null || (age >= i.age_min && age <= i.age_max)));
  const open = matches.filter((m) => !m.full).length;
  const target = KINDS.find((k) => k.kind === kind)!;

  function go() {
    const qs = new URLSearchParams();
    if (age !== null) qs.set("age", String(age));
    if (area) qs.set("q", area);
    if (kind === "darts") qs.set("type", "darts");
    router.push(`${target.path}${qs.size ? `?${qs}` : ""}`);
  }

  return (
    <div className="hero-finder" role="search" aria-label="Find something for your child">
      <p className="hf-q">What&apos;s on for your child?</p>
      <div className="hf-seg" role="radiogroup" aria-label="Type">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} onClick={() => { setKind(k.kind); setArea(""); }}>{k.label}</button>
        ))}
      </div>
      <div className="hf-ages" role="radiogroup" aria-label="Child's age">
        <span className="hf-label">Age</span>
        {AGES.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={age === a} onClick={() => setAge(age === a ? null : a)}>{a}</button>
        ))}
      </div>
      {areas.length > 1 && (
        <label className="hf-area">
          <span className="hf-label">Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Anywhere</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="btn hf-go" onClick={go}>
        {matches.length === 0 ? `See ${target.label.toLowerCase()} →` : open > 0 ? `Show ${open} with spaces →` : `Show ${matches.length} (join the waiting list) →`}
      </button>
      <p className="hf-live" aria-live="polite">
        {matches.length === 0 ? "Nothing matching yet, but new dates are added often." : `${matches.length} ${matches.length === 1 ? "match" : "matches"}${age !== null ? ` for age ${age}` : ""}${area ? ` in ${area}` : ""}`}
      </p>
    </div>
  );
}
