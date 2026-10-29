import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampFinder } from "@/components/CampFinder";
import { toCardData } from "@/lib/camp-cards";
import { getCampSlugs, getFlags, getUpcomingCamps } from "@/lib/data";
import { slugify } from "@/lib/format";

export const revalidate = 300;

const KNOWN_AREAS = ["Halifax", "Bradford", "Calderdale", "Kirklees"];

async function resolveArea(slug: string): Promise<string | null> {
  const fromCamps = (await getCampSlugs()).map((c) => c.area);
  return [...new Set([...fromCamps, ...KNOWN_AREAS])].find((a) => slugify(a) === slug) ?? null;
}

export async function generateStaticParams() {
  const areas = new Set([...(await getCampSlugs()).map((c) => c.area), ...KNOWN_AREAS]);
  return [...areas].map((a) => ({ area: slugify(a) }));
}

export async function generateMetadata({ params }: PageProps<"/holiday-camps/[area]">): Promise<Metadata> {
  const area = await resolveArea((await params).area);
  if (!area) return {};
  return {
    title: `Holiday camps in ${area}`,
    description: `Children's multi-sports holiday camps in ${area}, run by Prime Sports UK. Ages, dates, prices and spaces left.`,
    alternates: { canonical: `/holiday-camps/${slugify(area)}` },
  };
}

export default async function AreaPage({ params }: PageProps<"/holiday-camps/[area]">) {
  const area = await resolveArea((await params).area);
  if (!area) notFound();
  const [camps, flags] = await Promise.all([getUpcomingCamps(), getFlags()]);
  const local = camps.filter((c) => c.area === area);
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Holiday camps</div>
          <h1>Holiday camps in {area}</h1>
          <p>Fun-packed multi-sports holiday camps for children in {area}, in a safe, supportive environment where children leave happy.</p>
        </div>
      </div>
      <section style={{ paddingTop: "1rem" }}>
        <div className="wrap">
          {local.length ? (
            <CampFinder camps={local.map((c) => toCardData(c, flags))} layout="grid" />
          ) : (
            <div className="empty">
              <p>There are no camps in {area} on sale right now.</p>
              <p style={{ marginTop: "1rem" }}>
                <Link className="btn" href="/prime-camps#register">Get early access to Prime Camps</Link>{" "}
                <Link className="btn ghost" href="/camps">See all camps</Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
