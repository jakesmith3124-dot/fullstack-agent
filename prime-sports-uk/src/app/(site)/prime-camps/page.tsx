import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CampFinder } from "@/components/CampFinder";
import { FaqList } from "@/components/Faq";
import { LeadForm } from "@/components/LeadForm";
import { toCardData } from "@/lib/camp-cards";
import { getContent, getFlags, getUpcomingCamps } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Prime Camps: holiday camps for ages 5 to 17",
  description: "Prime Camps is the new holiday camp brand from Prime Sports UK. Multi-sports, team challenges, outdoor adventure and competitions for ages 5 to 17 across West Yorkshire, from February 2027.",
  alternates: { canonical: "/prime-camps" },
};

const ACTIVITIES: [string, string][] = [
  ["Multi-sports", "Football, basketball, tennis, dodgeball and more, coached properly."],
  ["Team challenges", "Problem-solving games that build friendships and teamwork."],
  ["Outdoor adventure", "Getting outside, exploring and burning off energy."],
  ["Specialist sports", "Archery, fencing, curling and alternative sports they won't try at school."],
  ["Competitions", "Leagues, tournaments and medals, pitched at the right level for each age."],
  ["Creative sessions", "Calmer activities to balance out the busy parts of the day."],
];

type ListBlock = { title: string; items?: string[]; paragraphs?: string[] };

export default async function PrimeCampsPage() {
  const [content, flags, camps] = await Promise.all([getContent(), getFlags(), getUpcomingCamps()]);
  const groups = content.section<{ ages: string; title: string; body: string }>("pc.groups");
  const timetable = content.get<{ items: [string, string, string][] }>("pc.timetable");
  const info = content.section<ListBlock>("pc.info");
  const faqs = content.section<{ q: string; a: string }>("pc.faq");
  const pcCamps = camps.filter((c) => c.brand === "prime_camps");

  return (
    <>
      <section className="pc-hero" style={{ padding: 0 }}>
        <div className="wrap">
          <div className="pc-hero-text">
            <span className="pc-pill">Launching February 2027</span>
            <h1>Holiday camps they&apos;ll talk about all term.</h1>
            <p>Prime Camps is the new holiday camp brand from Prime Sports UK. Multi-sports, team challenges, outdoor adventure and competitions for ages 5 to 17, across West Yorkshire.</p>
            <div className="actions">
              {flags.prime_camps_bookings && pcCamps.length ? (
                <a className="btn" href="#venues">Book a camp →</a>
              ) : (
                <a className="btn" href="#register">Get early access →</a>
              )}
              {timetable && <a className="btn ghost" href="#pc-day">See a day at camp</a>}
            </div>
          </div>
          <Image className="pc-logo" src="/brand/prime-camps-logo.png" alt="Prime Camps" width={483} height={520} priority />
        </div>
      </section>

      <section className="pc-facts">
        <div className="wrap">
          <div><b>5–17</b><span>Ages, grouped by stage</span></div>
          <div><b>Feb 2027</b><span>First camps</span></div>
          <div><b>3–5</b><span>Venues planned to start</span></div>
          <div><b>HWBT</b><span>Hard Work Beats Talent</span></div>
        </div>
      </section>

      {groups.length > 0 && (
        <section className="center">
          <div className="wrap">
            <div className="eyebrow">Age groups</div>
            <h2>The right camp for every age</h2>
            <p className="pc-sub">A five-year-old and a fifteen-year-old need very different days, so each age group gets its own programme, coaches and challenges.</p>
            <div className="pc-groups">
              {groups.map((g) => (
                <article className="pc-group" key={g.key}>
                  <span className="pc-age">{g.data.ages}</span>
                  <h3>{g.data.title}</h3>
                  <p>{g.data.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pc-acts">
        <div className="wrap">
          <div className="eyebrow">What they&apos;ll do</div>
          <h2>More than a sports camp</h2>
          <div className="pc-act-grid">
            {ACTIVITIES.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      {timetable && (
        <section id="pc-day">
          <div className="wrap pc-day-wrap">
            <div className="pc-day-text">
              <div className="eyebrow">A day at camp</div>
              <h2>What a typical day looks like</h2>
              <p className="muted">Every day is structured, active and varied, with proper breaks. Times will be confirmed for each venue before bookings open.</p>
            </div>
            <ol className="pc-timeline">
              {timetable.items.map(([t, a, b]) => (
                <li key={t + a}><time>{t}</time><div><b>{a}</b><span>{b}</span></div></li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {pcCamps.length > 0 && (
        <section id="venues" className="center">
          <div className="wrap">
            <div className="eyebrow">Venues</div>
            <h2>Find your Prime Camp</h2>
            <CampFinder camps={pcCamps.map((c) => toCardData(c, flags))} layout="grid" />
          </div>
        </section>
      )}

      {info.length > 0 && (
        <section className="pc-info">
          <div className="wrap">
            <div className="eyebrow">Good to know</div>
            <h2>Before you book</h2>
            <div className="pc-info-grid">
              {info.map((b) => (
                <div key={b.key}>
                  <h3>{b.data.title}</h3>
                  {b.data.items && <ul>{b.data.items.map((i) => <li key={i}>{i}</li>)}</ul>}
                  {b.data.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="faq-wrap">
          <div className="wrap">
            <div className="eyebrow">Questions</div>
            <h2 style={{ marginTop: 0 }}>Parent FAQ</h2>
            <FaqList items={faqs} />
            <p><Link className="link" href="/faq">See all parent questions</Link></p>
          </div>
        </section>
      )}

      <section id="register" className="pc-reg">
        <div className="wrap pc-reg-wrap">
          <div className="pc-reg-text">
            <div className="eyebrow">Early access</div>
            <h2>Be first to book</h2>
            <p>Sign up and we&apos;ll email you as soon as February bookings open, before they go public, with an early-bird offer for the first families.</p>
            <ul><li>First pick of spaces</li><li>Early-bird price</li><li>No obligation to book</li></ul>
          </div>
          <LeadForm kind="early_access" />
        </div>
      </section>
    </>
  );
}
