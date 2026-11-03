import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SchoolLogo } from "@/components/CampCard";
import { DayPicker } from "@/components/DayPicker";
import { JsonLd } from "@/components/JsonLd";
import { WaitingListForm } from "@/components/WaitingListForm";
import { getCampBySlug, getCampSlugs, getFlags, isBookable } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { dateRange, gbp, longDate, shortDay, timeRange, todayLondon } from "@/lib/format";
import { spaceLevel, spacesLeft } from "@/lib/pricing";
import { hasTimeSlots, kindWords, slotTime } from "@/lib/camp-kind";
import { publicImageUrl } from "@/lib/storage";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCampSlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/camps/[slug]">): Promise<Metadata> {
  const camp = await getCampBySlug((await params).slug);
  if (!camp) return { title: "Camp not found" };
  const dates = dateRange(camp.days.map((d) => d.date));
  const w = kindWords(camp.kind);
  return {
    title: `${camp.school} ${w.noun}, ${camp.area}`,
    description: `${w.label} at ${camp.school}, ${camp.area}. Ages ${camp.age_min} to ${camp.age_max}. ${dates}. From ${gbp(camp.price_per_day_pence)} per ${w.unit}.`,
    alternates: { canonical: `/camps/${camp.slug}` },
    openGraph: camp.photo_path ? { images: [publicImageUrl(camp.photo_path)!] } : undefined,
  };
}

export default async function CampPage({ params }: PageProps<"/camps/[slug]">) {
  const { slug } = await params;
  const [camp, flags] = await Promise.all([getCampBySlug(slug), getFlags()]);
  if (!camp) notFound();
  const today = todayLondon();
  const upcoming = camp.days.filter((d) => d.date >= today);
  const past = upcoming.length === 0;
  const bookable = !past && isBookable(camp, flags);
  const fullDays = upcoming.filter((d) => spaceLevel(d) === "full");
  const photo = publicImageUrl(camp.photo_path);
  const w = kindWords(camp.kind);
  const slots = hasTimeSlots(upcoming);
  const mapQuery = encodeURIComponent([camp.school, camp.address, camp.postcode].filter(Boolean).join(", "));

  const events = upcoming.map((d) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${camp.school} ${w.noun}`,
    startDate: `${d.date}T${(d.start_time ?? camp.start_time).slice(0, 5)}`,
    endDate: `${d.date}T${(d.end_time ?? camp.end_time).slice(0, 5)}`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: camp.school, address: [camp.address, camp.area, camp.postcode].filter(Boolean).join(", ") },
    organizer: { "@type": "Organization", name: "Prime Sports UK", url: SITE_URL },
    offers: { "@type": "Offer", price: (camp.price_per_day_pence / 100).toFixed(2), priceCurrency: "GBP", url: `${SITE_URL}/book/${camp.slug}`, availability: spaceLevel(d) === "full" ? "https://schema.org/SoldOut" : "https://schema.org/InStock" },
    typicalAgeRange: `${camp.age_min}-${camp.age_max}`,
    ...(photo ? { image: [photo] } : {}),
  }));

  return (
    <>
      {events.length > 0 && <JsonLd data={events} />}
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">{w.weekly ? `${w.label} · ` : ""}{camp.area}{camp.is_demo ? " · Example camp" : ""}</div>
          <h1>{camp.school}</h1>
          <p>{camp.description || (w.weekly ? `Weekly ${camp.kind === "darts" ? "darts" : "club"} sessions for ages ${camp.age_min} to ${camp.age_max}. Book single weeks or the whole term.` : `Multi-sports holiday camp for ages ${camp.age_min} to ${camp.age_max}.`)}</p>
        </div>
      </div>
      <section style={{ paddingTop: "2rem" }}>
        <div className="wrap camp-detail">
          <div className="camp" style={{ alignSelf: "start" }}>
            <div className="camp-img">
              {photo ? <Image src={photo} alt={camp.photo_alt || `Children at ${camp.school}`} fill sizes="(max-width: 820px) 100vw, 560px" priority /> : <span>Photo coming soon</span>}
              <SchoolLogo school={camp.school} logoPath={camp.logo_path} />
            </div>
            <div className="camp-body">
              <span className="age">{camp.age_min} to {camp.age_max} Years</span>
              <p><b>{dateRange(camp.days.map((d) => d.date))}</b></p>
              <p>{slots ? `Choose a time: ${[...new Set(upcoming.map(slotTime))].join(", ")}` : timeRange(camp.start_time, camp.end_time)}</p>
              <p>
                From <b>{gbp(camp.price_per_day_pence)}</b> per {w.unit}
                {camp.full_week_price_pence ? <> · <b>{gbp(camp.full_week_price_pence)}</b> for the {w.whole}</> : null}
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gap: "1.2rem", alignContent: "start" }}>
            {bookable && fullDays.length < upcoming.length ? (
              <div className="card">
                <DayPicker slug={camp.slug} kind={camp.kind ?? "camp"} days={upcoming} pricePerDayPence={camp.price_per_day_pence}
                  fullWeekPricePence={camp.full_week_price_pence} totalDays={camp.days.length} />
              </div>
            ) : (
            <div className="card">
              <h2 className="h3-size">{w.weekly ? "Sessions and spaces" : "Days and spaces"}</h2>
              {past ? (
                <p className="muted">This {w.weekly ? "term" : "camp"} has finished. <Link href={w.weekly ? "/clubs" : "/camps"}>See what&apos;s coming up</Link>.</p>
              ) : (
                <ul className="day-list">
                  {upcoming.map((d) => {
                    const left = spacesLeft(d);
                    return (
                      <li key={d.day_id}>
                        <span>{shortDay(d.date)}{slots ? `, ${slotTime(d)}` : ""}</span>
                        <span className={`sp ${spaceLevel(d)}`}>{left <= 0 ? "Full" : `${left} spaces left`}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!past && !bookable && <p className="muted">Bookings aren&apos;t open yet.</p>}
            </div>
            )}
            {fullDays.length > 0 && (
              <div className="card">
                <h2 className="h3-size">Join the waiting list</h2>
                <p className="muted">We&apos;ll email you if a space opens up on a full {w.unit}.</p>
                <WaitingListForm days={fullDays.map((d) => ({ id: d.day_id, label: `${longDate(d.date)}${slots ? `, ${slotTime(d)}` : ""}` }))} />
              </div>
            )}
            <div className="card">
              <h2 className="h3-size">Venue</h2>
              <p>{[camp.school, camp.address, camp.area, camp.postcode].filter(Boolean).join(", ")}</p>
              <a className="link" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener">Open in Google Maps (new tab)</a>
            </div>
            {camp.what_to_bring && (
              <div className="card">
                <h2 className="h3-size">What to bring</h2>
                <p>{camp.what_to_bring}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
