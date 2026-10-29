import Image from "next/image";
import Link from "next/link";
import { CampFinder } from "@/components/CampFinder";
import { ContentImage } from "@/components/ContentImage";
import { JsonLd, localBusinessJsonLd } from "@/components/JsonLd";
import { SafetyGrid } from "@/components/SafetyGrid";
import { TeamGrid } from "@/components/TeamGrid";
import { toCardData } from "@/lib/camp-cards";
import { getContent, getFlags, getUpcomingCamps } from "@/lib/data";
import { FACEBOOK_URL } from "@/lib/env";

export const revalidate = 60;

type Text = { eyebrow?: string; title: string; body?: string };
type Img = { path: string | null; alt: string };

const SPORTS = ["Football", "Archery", "Fencing", "Curling", "Basketball", "Tennis", "Darts", "Team games"];
const SPORT_CLASSES = ["s1", "s2", "s3", "s4", "s2", "s1", "s4", "s3"];
const SERVICES: [string, string][] = [
  ["Holiday camps", "Multi-sports days with games, challenges and specialist activities."],
  ["Football coaching", "Structured sessions focused on skills, confidence and progress."],
  ["School PE", "Curriculum PE support and sports coaching for primary schools."],
  ["School clubs", "Breakfast, lunchtime and after-school clubs run by our coaches."],
  ["Specialist sports", "Fencing, archery, curling and other alternative sports."],
  ["Community sport", "Enrichment and activity sessions with local organisations."],
  ["Funded programmes", "HAF and community-funded holiday provision."],
  ["Partnerships", "Working alongside schools, clubs and community groups."],
];

export default async function HomePage() {
  const [content, camps, flags] = await Promise.all([getContent(), getUpcomingCamps(), getFlags()]);
  const hero = content.get<Text>("home.hero");
  const badges = content.section<{ title: string }>("home.badges");
  const philosophy = content.get<Text>("home.philosophy");
  const parents = content.get<Text>("home.parents");
  const schools = content.get<Text>("home.schools");
  const hwbt = content.get<Text>("home.hwbt");
  const facts = content.section<{ title: string; body: string }>("home.facts");
  const heroImg = content.get<Img>("home.hero_image");
  const parentsImg = content.get<Img>("home.parents_image");
  const schoolsImg = content.get<Img>("home.schools_image");

  return (
    <>
      <JsonLd data={localBusinessJsonLd()} />
      <div className="hero">
        <div className="wrap">
          <div>
            {hero?.eyebrow && <div className="eyebrow">{hero.eyebrow}</div>}
            <h1>{hero?.title ?? "Inspiring children to move, play and grow."}</h1>
            {hero?.body && <p>{hero.body}</p>}
            <div className="actions">
              <Link className="btn" href="/camps">Book a session →</Link>
              <Link className="btn ghost" href="/contact">Get in touch</Link>
            </div>
            {badges.length > 0 && (
              <div className="badges">
                {badges.map((b) => <span key={b.key}><b aria-hidden="true">✓</b> {b.data.title}</span>)}
              </div>
            )}
            <a className="reviews" href={FACEBOOK_URL} target="_blank" rel="noopener">
              <span className="stars" aria-hidden="true">★★★★★</span> See what parents say on Facebook →
            </a>
          </div>
          <div className={`pitch${heroImg?.path ? "" : " empty"}`} role={heroImg?.path ? undefined : "img"} aria-label={heroImg?.path ? undefined : "Photo placeholder: football pitch"}>
            {heroImg?.path ? (
              <ContentImage path={heroImg.path} alt={heroImg.alt} sizes="(max-width: 820px) 100vw, 480px" priority />
            ) : (
              <>
                <div className="line" />
                <div className="tag">Your photo here</div>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="help">
        <div className="wrap">
          <div className="help-grid">
            <Link className="help-card" href="/camps">
              <span className="eyebrow">For parents</span>
              <h2 className="h3-size">Find a club or camp for your child</h2>
              <p>Holiday camps, football academy and term-time clubs.</p>
              <span className="go">See what you can book →</span>
            </Link>
            <Link className="help-card" href="/schools">
              <span className="eyebrow">For schools</span>
              <h2 className="h3-size">Bring Prime Sports into your school</h2>
              <p>PE support, breakfast, lunchtime and after-school clubs, and enrichment.</p>
              <span className="go">See how we can help →</span>
            </Link>
          </div>
        </div>
      </section>

      {philosophy && (
        <section className="philo center">
          <div className="wrap">
            <div className="eyebrow">{philosophy.eyebrow}</div>
            <h2>{philosophy.title}</h2>
            <p>{philosophy.body}</p>
          </div>
        </section>
      )}

      {parents && (
        <section className="feature">
          <div className="wrap">
            <div className="media m1">{parentsImg?.path ? <ContentImage path={parentsImg.path} alt={parentsImg.alt} sizes="(max-width: 820px) 100vw, 540px" /> : "Camps"}</div>
            <div className="text">
              <div className="eyebrow">{parents.eyebrow}</div>
              <h2>{parents.title}</h2>
              <p>{parents.body}</p>
              <Link className="btn" href="/camps">See what you can book</Link>
            </div>
          </div>
        </section>
      )}

      {schools && (
        <section className="feature flip">
          <div className="wrap">
            <div className="media m2">{schoolsImg?.path ? <ContentImage path={schoolsImg.path} alt={schoolsImg.alt} sizes="(max-width: 820px) 100vw, 540px" /> : "Schools"}</div>
            <div className="text">
              <div className="eyebrow">{schools.eyebrow}</div>
              <h2>{schools.title}</h2>
              <p>{schools.body}</p>
              <Link className="btn" href="/schools">Talk to us</Link>
            </div>
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <section className="facts">
          <div className="wrap">
            {facts.map((f) => (
              <div className="fact" key={f.key}>
                <h3>{f.data.title}</h3>
                <p>{f.data.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="center">
        <div className="wrap">
          <div className="eyebrow">What we coach</div>
          <h2>More than just football</h2>
          <ul className="sports-grid" style={{ listStyle: "none", padding: 0 }}>
            {SPORTS.map((s, i) => <li key={s} className={`sport ${SPORT_CLASSES[i]}`}>{s}</li>)}
          </ul>
        </div>
      </section>

      <section className="center" id="camps">
        <div className="wrap">
          <div className="eyebrow">Holiday camps</div>
          <h2>Find a camp near you</h2>
          <CampFinder
            camps={camps.map((c) => toCardData(c, flags))}
            after={
              <article className="camp">
                <div className="camp-img ci-logo">
                  <Image src="/brand/prime-camps-logo.png" alt="Prime Camps logo" width={200} height={215} style={{ height: "100%", maxHeight: 260, width: "auto" }} />
                </div>
                <div className="camp-body">
                  <h3>Prime Camps</h3>
                  <span className="age">5 to 17 Years</span>
                  <p>Our new holiday camp brand, launching February 2027 across Yorkshire. Register your interest to hear first.</p>
                  <div className="areas"><Link className="area" href="/prime-camps#register">Register interest</Link></div>
                </div>
              </article>
            }
          />
        </div>
      </section>

      <section className="center" id="services">
        <div className="wrap">
          <div className="eyebrow">What we deliver</div>
          <h2>Sport for every child, all year round</h2>
          <div className="serv-grid">
            {SERVICES.map(([t, d]) => (
              <div className="serv" key={t}><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="prog">
        <div className="wrap">
          <div className="center on-dark"><div className="eyebrow">Coming next</div><h2>Two new programmes from Prime Sports UK</h2></div>
          <div className="prog-grid">
            <div className="prog-card">
              <span className="pill">Launching 2027</span>
              <h3>Prime Camps</h3>
              <p>Our dedicated holiday camp brand, with first camps planned from February 2027 across several Yorkshire venues.</p>
              <ul>
                <li>Ages 5 to 17, with separate groups for younger children and teenagers</li>
                <li>Multi-sports, team challenges, outdoor adventure and competitions</li>
                <li>Football and specialist activities</li>
                <li>Creative, inclusive and accessible sessions</li>
              </ul>
              <Link className="btn" href="/prime-camps#register">Register your interest →</Link>
            </div>
            <div className="prog-card">
              <span className="pill soon">Coming 2027</span>
              <h3>G.O.A.T Football Academy</h3>
              <p>Structured, enjoyable football coaching built around individual progression and player confidence.</p>
              <ul>
                <li>Professional coaching in a positive environment</li>
                <li>Focus on each player&apos;s own development</li>
                <li>Ball mastery, decision-making and teamwork</li>
                <li>Free trial session for new players</li>
              </ul>
              <Link className="btn" href="/goat#waiting-list">Join the waiting list →</Link>
            </div>
          </div>
        </div>
      </section>

      {hwbt && (
        <section className="hwbt">
          <div className="wrap center">
            <div className="eyebrow">{hwbt.eyebrow}</div>
            <div className="hwbt-mark" aria-hidden="true">HWBT</div>
            <h2>{hwbt.title}</h2>
            <p>{hwbt.body}</p>
          </div>
        </section>
      )}

      <SafetyGrid content={content} />

      <TeamGrid content={content} />

      <section className="ea-band">
        <div className="wrap">
          <div className="ea-inner">
            <Image src="/brand/prime-camps-logo.png" alt="" width={72} height={77} />
            <div>
              <h2>Get early access to Prime Camps</h2>
              <p>Sign up and you&apos;ll hear first when February bookings open, with an early-bird offer for the first families.</p>
            </div>
            <Link className="btn" href="/prime-camps#register">Sign up for early access →</Link>
          </div>
        </div>
      </section>

      <section id="contact">
        <div className="wrap">
          <div className="cta-band">
            <div><h2>Ready to get moving?</h2><p>Book a session at any of our locations.</p></div>
            <Link className="btn" href="/camps">Make a Booking →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
