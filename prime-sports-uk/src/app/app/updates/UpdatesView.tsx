"use client";
import { useState } from "react";
import { fmtClock, fmtDateTime } from "@/lib/format";

export type FeedPost = { id: string; kind: string; title: string; body: string | null; photos: string[]; group: string | null; camp: string; at: string };

export function UpdatesView({ posts }: { posts: FeedPost[] }) {
  const [filter, setFilter] = useState("all");
  const camps = [...new Set(posts.map((p) => p.camp))];
  const groups = [...new Set(posts.map((p) => p.group).filter(Boolean))] as string[];
  const shown = posts.filter((p) =>
    filter === "all" || (filter === "photo" && p.kind === "photo") || (filter === "note" && p.kind !== "photo") || p.camp === filter || p.group === filter);
  const today = new Date().toDateString();
  return (
    <main className="pa-pad">
      <section>
        <h2>Live updates</h2>
        <div className="chips" role="group" aria-label="Filter updates">
          {[["all", "All"], ["photo", "Photos"], ["note", "Coach notes"], ...(camps.length > 1 ? camps.map((c) => [c, c]) : []), ...groups.map((g) => [g, g])].map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {!shown.length && <p className="muted">No updates yet. Coaches post photos and notes here during camp days.</p>}
        <div style={{ display: "grid", gap: "1rem" }}>
          {shown.map((p) => p.photos.length ? (
            <article className="post" key={p.id}>
              {p.photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`${p.title}, photo ${i + 1}`} loading="lazy" />
              ))}
              <div className="body">
                <div className="row" style={{ alignItems: "baseline" }}><h3>{p.title}</h3><span className="muted">{new Date(p.at).toDateString() === today ? fmtClock(p.at) : fmtDateTime(p.at)}</span></div>
                {p.body && <p className="muted">{p.body}</p>}
                <div className="actions">
                  {p.photos.map((src, i) => <a key={i} className="mini" href={src} download={`prime-camps-${p.id.slice(0, 6)}-${i + 1}.webp`}>Save photo{p.photos.length > 1 ? ` ${i + 1}` : ""}</a>)}
                </div>
              </div>
            </article>
          ) : (
            <article className="card note" key={p.id}>
              <div className="av" aria-hidden="true">PC</div>
              <div>
                <div className="row" style={{ alignItems: "baseline" }}><b>{p.title}</b><span className="muted">{new Date(p.at).toDateString() === today ? fmtClock(p.at) : fmtDateTime(p.at)}</span></div>
                {p.body && <p className="muted">{p.body}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
