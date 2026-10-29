import type { Metadata } from "next";
import { ContentImage } from "@/components/ContentImage";
import { LeadForm } from "@/components/LeadForm";
import { getContent } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Sports coaching for schools",
  description: "PE support, breakfast, lunchtime and after-school clubs, enrichment days and funded holiday programmes for schools across West Yorkshire.",
  alternates: { canonical: "/schools" },
};

const OFFER: [string, string][] = [
  ["PE support", "Curriculum PE lessons and sports coaching alongside your staff, planned around your school's needs."],
  ["Breakfast clubs", "An active, supervised start to the day, run by our coaches."],
  ["Lunchtime clubs", "Structured games and sport that keep lunchtimes active and calm."],
  ["After-school clubs", "Multi-sports, football and specialist sports clubs after the school day."],
  ["Enrichment", "Specialist sports days and activities: archery, fencing, curling and more."],
  ["HAF and funded programmes", "Holiday Activities and Food and other community-funded holiday provision."],
];

export default async function SchoolsPage() {
  const content = await getContent();
  const schools = content.get<{ eyebrow: string; title: string; body: string }>("home.schools");
  const img = content.get<{ path: string | null; alt: string }>("home.schools_image");
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">For schools</div>
          <h1>{schools?.title ?? "Energy and expertise for your PE"}</h1>
          {schools?.body && <p>{schools.body}</p>}
        </div>
      </div>
      <section className="feature">
        <div className="wrap">
          <div className="media m2">{img?.path ? <ContentImage path={img.path} alt={img.alt} sizes="(max-width: 820px) 100vw, 540px" /> : "Schools"}</div>
          <div className="text">
            <div className="eyebrow">Working with independent and state schools</div>
            <h2>Sport that fits your timetable</h2>
            <p>We bring the standards of a serious sports organisation, with all the energy and fun children expect. Whether you need weekly PE support, a full programme of clubs or one-off enrichment days, we&apos;ll plan it with you.</p>
            <a className="btn" href="#enquire">Make an enquiry</a>
          </div>
        </div>
      </section>
      <section className="center" id="services" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="eyebrow">What we offer</div>
          <h2>How we can help your school</h2>
          <div className="serv-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {OFFER.map(([t, d]) => <div className="serv" key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>
      <section id="enquire" className="pc-reg">
        <div className="wrap pc-reg-wrap">
          <div className="pc-reg-text">
            <div className="eyebrow">Enquiries</div>
            <h2>Talk to us about your school</h2>
            <p>Tell us a little about your school and what you&apos;re looking for, and we&apos;ll get back to you.</p>
          </div>
          <LeadForm kind="school" />
        </div>
      </section>
    </>
  );
}
