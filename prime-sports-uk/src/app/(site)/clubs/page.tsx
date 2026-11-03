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

export default async function ClubsPage({ searchParams }: PageProps<"/clubs">) {
  const [all, flags, sp] = await Promise.all([getUpcomingCamps(["club", "darts"]), getFlags(), searchParams]);
  // Filters arrive from the home page finder: ?age=7&q=Halifax&type=darts
  const ageNum = typeof sp.age === "string" ? Number(sp.age) : NaN;
  const age = Number.isInteger(ageNum) ? ageNum : null;
  const area = typeof sp.q === "string" ? sp.q : "";
  const camps = all.filter((c) => (age === null || (age >= c.age_min && age <= c.age_max)) && (!area || c.area === area));
  const dartsFirst = sp.type === "darts";
  const clubs = camps.filter((c) => c.kind === "club");
  const darts = camps.filter((c) => c.kind === "darts");
  const filtered = age !== null || !!area;
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
          {filtered && (
            <p className="muted">
              Showing {[age !== null && `age ${age}`, area && `in ${area}`].filter(Boolean).join(" ")}. <Link href="/clubs">Show everything</Link>
            </p>
          )}
          <div style={{ order: dartsFirst ? 2 : 1 }}>
            <h2>School clubs</h2>
            <div className="camp-grid">
              {clubs.length ? clubs.map((c, i) => <CampCard key={c.slug} camp={toCardData(c, flags)} index={i} />) : <p className="empty">No clubs are open for booking yet. Check back soon.</p>}
            </div>
          </div>
          <div style={{ order: dartsFirst ? 1 : 2 }}>
            <h2>Darts</h2>
            <div className="camp-grid">
              {darts.length ? darts.map((c, i) => <CampCard key={c.slug} camp={toCardData(c, flags)} index={i} />) : <p className="empty">No darts sessions are open for booking yet. Check back soon.</p>}
            </div>
          </div>
          <p className="center" style={{ order: 3 }}>
            <Link className="btn ghost" href="/schools">Want a club at your school? Talk to us →</Link>
          </p>
        </div>
      </section>
    </>
  );
}
