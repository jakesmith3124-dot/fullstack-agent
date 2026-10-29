"use client";
import { useMemo, useState, type ReactNode } from "react";
import { CampCard, type CampCardData } from "./CampCard";

const PAGE = 12;

export function CampFinder({ camps, initialQuery = "", layout = "list", after }: {
  camps: (CampCardData & { address?: string | null; postcode?: string | null })[];
  initialQuery?: string;
  layout?: "list" | "grid";
  after?: ReactNode;
}) {
  const [q, setQ] = useState(initialQuery);
  const [shown, setShown] = useState(PAGE);
  const areas = useMemo(() => [...new Set(camps.map((c) => c.area))].sort(), [camps]);
  const term = q.trim().toLowerCase();
  const list = camps.filter(
    (c) => !term || [c.area, c.school, c.address, c.postcode].filter(Boolean).join(" ").toLowerCase().includes(term),
  );

  return (
    <>
      <div className="filter">
        <label htmlFor="campSearch">Find a camp near you</label>
        <input
          id="campSearch"
          type="search"
          placeholder="Type your area, town or school (e.g. Halifax)"
          autoComplete="off"
          value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
        />
        {areas.length > 1 && (
          <div className="chips" role="group" aria-label="Filter by area">
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                className="chip"
                aria-pressed={term === a.toLowerCase()}
                onClick={() => { setQ(term === a.toLowerCase() ? "" : a); setShown(PAGE); }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={layout === "grid" ? "camp-grid" : "camp-list"}>
        <p className="sr-only" aria-live="polite">{list.length} camps found</p>
        {list.length === 0 && (
          <p className="empty">
            {camps.length
              ? `No camps found for “${q}” yet. Try another area, or register your interest below.`
              : "New camps coming soon."}
          </p>
        )}
        {list.slice(0, shown).map((c, i) => <CampCard key={c.slug} camp={c} index={i} />)}
        {list.length > shown && (
          <button type="button" className="btn ghost" style={{ justifySelf: "center" }} onClick={() => setShown((s) => s + PAGE)}>
            Show more camps ({list.length - shown} more)
          </button>
        )}
        {after}
      </div>
    </>
  );
}
