import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { getContent, getFlags } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "G.O.A.T Football Academy: coming 2027",
  description: "Structured, enjoyable football coaching built around each player's own progress. Coming to West Yorkshire in 2027. Join the waiting list.",
  alternates: { canonical: "/goat" },
};

export default async function GoatPage() {
  const [content, flags] = await Promise.all([getContent(), getFlags()]);
  const info = content.section<{ title: string; body: string }>("goat.info");
  const details = content.get<{ title: string; body: string }>("goat.details");
  return (
    <>
      <section className="gt-hero" style={{ padding: 0 }}>
        <div className="wrap">
          <span className="pc-pill">Coming 2027</span>
          <div className="gt-word" aria-hidden="true">G.O.A.T</div>
          <h1>Football Academy</h1>
          <p>Structured, enjoyable football coaching built around each player&apos;s own progress. Coming to West Yorkshire in 2027.</p>
          <div className="actions">
            {flags.goat_memberships ? (
              <Link className="btn" href="/memberships">Become a member →</Link>
            ) : (
              <a className="btn" href="#waiting-list">Join the waiting list →</a>
            )}
          </div>
        </div>
      </section>

      <section className="center">
        <div className="wrap">
          <div className="eyebrow">What it&apos;s about</div>
          <h2>Better players, more confident kids</h2>
          <p className="pc-sub">G.O.A.T is for children who love football and want to improve. Every player gets coaching pitched at their level, with clear goals and regular feedback on how they&apos;re progressing.</p>
          <div className="pc-groups">
            <article className="pc-group"><span className="pc-age">01</span><h3>Individual progression</h3><p>Each player works on their own targets, so beginners and confident players both improve.</p></article>
            <article className="pc-group"><span className="pc-age">02</span><h3>Ball mastery</h3><p>Lots of touches: dribbling, first touch, passing and finishing, built up session by session.</p></article>
            <article className="pc-group"><span className="pc-age">03</span><h3>Game understanding</h3><p>Decision-making, positioning and teamwork in small-sided games.</p></article>
          </div>
        </div>
      </section>

      <section className="pc-info">
        <div className="wrap">
          <div className="eyebrow">What to expect</div>
          <h2>How the academy will work</h2>
          {info.length > 0 && (
            <div className="pc-info-grid">
              {info.map((i) => <div key={i.key}><h3>{i.data.title}</h3><p>{i.data.body}</p></div>)}
            </div>
          )}
          {details && <p><b>{details.title}:</b> {details.body}</p>}
          <p className="note-line">G.O.A.T is about enjoyment, confidence and steady improvement. We don&apos;t promise professional contracts or academy places, but we will help every player get better.</p>
        </div>
      </section>

      <section id="waiting-list" className="pc-reg">
        <div className="wrap pc-reg-wrap">
          <div className="pc-reg-text">
            <div className="eyebrow">Waiting list</div>
            <h2>Be first on the pitch</h2>
            <p>Join the waiting list and we&apos;ll contact you before sessions open, with a free trial for your child.</p>
            <ul><li>Priority for the first sessions</li><li>Free trial session</li><li>No obligation to join</li></ul>
          </div>
          <LeadForm kind="goat" />
        </div>
      </section>
    </>
  );
}
