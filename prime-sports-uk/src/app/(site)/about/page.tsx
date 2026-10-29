import type { Metadata } from "next";
import Link from "next/link";
import { TeamGrid } from "@/components/TeamGrid";
import { getContent } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "About us",
  description: "Prime Sports UK runs children's sports coaching, holiday camps and football development across West Yorkshire. Hard Work Beats Talent.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const content = await getContent();
  const philosophy = content.get<{ eyebrow: string; title: string; body: string }>("home.philosophy");
  const hwbt = content.get<{ eyebrow: string; title: string; body: string }>("home.hwbt");
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">About us</div>
          <h1>Putting children first</h1>
          <p>Children&apos;s sports coaching, holiday camps and football development across Halifax, Bradford, Calderdale, Kirklees and surrounding West Yorkshire.</p>
        </div>
      </div>
      {philosophy && (
        <section className="philo center">
          <div className="wrap"><div className="eyebrow">{philosophy.eyebrow}</div><h2>{philosophy.title}</h2><p>{philosophy.body}</p></div>
        </section>
      )}
      {hwbt && (
        <section className="hwbt">
          <div className="wrap center"><div className="eyebrow">{hwbt.eyebrow}</div><div className="hwbt-mark" aria-hidden="true">HWBT</div><h2>{hwbt.title}</h2><p>{hwbt.body}</p></div>
        </section>
      )}
      <TeamGrid content={content} />
      <section style={{ paddingTop: 0 }}>
        <div className="wrap"><div className="cta-band"><div><h2>Come and see for yourself</h2><p>Find a camp near you, or get in touch.</p></div><Link className="btn" href="/camps">Find a camp →</Link></div></div>
      </section>
    </>
  );
}
