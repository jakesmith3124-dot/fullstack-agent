import type { Metadata } from "next";
import Link from "next/link";
import { CampCard } from "@/components/CampCard";
import { toCardData } from "@/lib/camp-cards";
import { getFlags, getUpcomingCamps } from "@/lib/data";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "School clubs and darts",
  description: "Book Prime Sports UK after-school clubs and darts sessions across West Yorkshire. Pay week by week or book the whole term.",
  alternates: { canonical: "/clubs" },
};

export default async function ClubsPage() {
  const [camps, flags] = await Promise.all([getUpcomingCamps(["club", "darts"]), getFlags()]);
  const clubs = camps.filter((c) => c.kind === "club");
  const darts = camps.filter((c) => c.kind === "darts");
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Term time</div>
          <h1>School clubs and darts</h1>
          <p>Weekly clubs and darts sessions. Book the weeks you want, or the whole term in one go.</p>
        </div>
      </div>
      <section style={{ paddingTop: "1rem" }}>
        <div className="wrap" style={{ display: "grid", gap: "2.5rem" }}>
          <div>
            <h2>School clubs</h2>
            <div className="camp-grid">
              {clubs.length ? clubs.map((c, i) => <CampCard key={c.slug} camp={toCardData(c, flags)} index={i} />) : <p className="empty">No clubs are open for booking yet. Check back soon.</p>}
            </div>
          </div>
          <div>
            <h2>Darts</h2>
            <div className="camp-grid">
              {darts.length ? darts.map((c, i) => <CampCard key={c.slug} camp={toCardData(c, flags)} index={i} />) : <p className="empty">No darts sessions are open for booking yet. Check back soon.</p>}
            </div>
          </div>
          <p className="center">
            <Link className="btn ghost" href="/schools">Want a club at your school? Talk to us →</Link>
          </p>
        </div>
      </section>
    </>
  );
}
