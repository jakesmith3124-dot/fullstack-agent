import type { Metadata } from "next";
import { FaqList } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { getContent } from "@/lib/data";
import { CONTACT_EMAIL } from "@/lib/env";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Parent FAQ",
  description: "Everything you need to know before your child's first Prime Sports UK session: booking, payments, the day itself, health and safety.",
  alternates: { canonical: "/faq" },
};

const GROUPS: [string, string, string][] = [
  ["faq.book", "fq-book", "Booking & payments"],
  ["faq.day", "fq-day", "On the day"],
  ["faq.health", "fq-health", "Health & safety"],
  ["faq.more", "fq-more", "Everything else"],
];

export default async function FaqPage() {
  const content = await getContent();
  const groups = GROUPS.map(([section, id, title]) => ({ id, title, items: content.section<{ q: string; a: string }>(section) })).filter((g) => g.items.length);
  const all = groups.flatMap((g) => g.items);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: all.map((f) => ({ "@type": "Question", name: f.data.q, acceptedAnswer: { "@type": "Answer", text: f.data.a } })) }} />
      <section className="faq-head">
        <div className="wrap">
          <div className="eyebrow">Help for parents</div>
          <h1>Frequently asked questions</h1>
          <p>Everything you need to know before your child&apos;s first session. Can&apos;t find your answer? Email <a href={`mailto:${CONTACT_EMAIL}`}><b>{CONTACT_EMAIL}</b></a>.</p>
          <nav className="faq-jump" aria-label="FAQ sections">
            {groups.map((g) => <a key={g.id} href={`#${g.id}`}>{g.title}</a>)}
          </nav>
        </div>
      </section>
      <section className="faq-wrap" style={{ paddingTop: "1rem" }}>
        <div className="wrap">
          {groups.map((g) => (
            <div key={g.id}>
              <h2 id={g.id}>{g.title}</h2>
              <FaqList items={g.items} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
