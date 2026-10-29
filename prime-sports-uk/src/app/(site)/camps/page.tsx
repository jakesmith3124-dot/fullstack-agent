import type { Metadata } from "next";
import Link from "next/link";
import { CampFinder } from "@/components/CampFinder";
import { toCardData } from "@/lib/camp-cards";
import { getFlags, getUpcomingCamps } from "@/lib/data";
import { slugify } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Holiday camps near you",
  description: "Find a Prime Sports UK holiday camp near you in Halifax, Bradford, Calderdale and Kirklees. Book single days or the full week.",
  alternates: { canonical: "/camps" },
};

export default async function CampsPage({ searchParams }: PageProps<"/camps">) {
  const [camps, flags, sp] = await Promise.all([getUpcomingCamps(), getFlags(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const areas = [...new Set(camps.map((c) => c.area))].sort();
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Holiday camps</div>
          <h1>Find a camp near you</h1>
          <p>Multi-sports holiday camps across West Yorkshire. Book single days or the whole week, and add brothers and sisters to the same booking.</p>
        </div>
      </div>
      <section style={{ paddingTop: "1rem" }}>
        <div className="wrap">
          <CampFinder camps={camps.map((c) => toCardData(c, flags))} initialQuery={q} layout="grid" />
          {areas.length > 0 && (
            <p className="muted center" style={{ marginTop: "2.5rem" }}>
              Browse by area:{" "}
              {areas.map((a, i) => (
                <span key={a}>{i > 0 && " · "}<Link href={`/holiday-camps/${slugify(a)}`}>Holiday camps in {a}</Link></span>
              ))}
            </p>
          )}
          <p className="center" style={{ marginTop: "2rem" }}>
            <Link className="btn ghost" href="/prime-camps#register">Can&apos;t see your area? Register for Prime Camps →</Link>
          </p>
        </div>
      </section>
    </>
  );
}
