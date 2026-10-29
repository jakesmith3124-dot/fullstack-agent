import Link from "next/link";
import type { getContent } from "@/lib/data";

type Content = Awaited<ReturnType<typeof getContent>>;

/** Safety & trust tiles. Unconfirmed claims (qualifications, first aid, DSL, insurance, Ofsted) stay hidden until confirmed in admin. */
export function SafetyGrid({ content, showFaqLink = true }: { content: Content; showFaqLink?: boolean }) {
  const head = content.get<{ eyebrow: string; title: string; body: string }>("safety.head");
  const tiles = content.section<{ icon: string; title: string; body: string }>("safety.tiles");
  if (!tiles.length) return null;
  return (
    <section className="safety" id="safety">
      <div className="wrap">
        {head && (
          <div className="safety-head">
            <div className="eyebrow">{head.eyebrow}</div>
            <h2>{head.title}</h2>
            <p>{head.body}</p>
          </div>
        )}
        <div className="safety-grid">
          {tiles.map((t) => (
            <div className="sf" key={t.key}>
              <span className="sf-ic" aria-hidden="true">{t.data.icon}</span>
              <h3>{t.data.title}</h3>
              <p>{t.data.body}</p>
            </div>
          ))}
        </div>
        {showFaqLink && (
          <div className="safety-foot">
            <Link className="btn ghost" href="/faq">Read our parent FAQ →</Link>
          </div>
        )}
      </div>
    </section>
  );
}
