import Image from "next/image";
import Link from "next/link";
import { dateRange, gbp, initials, shortDay, timeRange } from "@/lib/format";
import { spaceLevel, spacesLeft } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/storage";

export type CampCardData = {
  slug: string;
  school: string;
  area: string;
  age_min: number;
  age_max: number;
  start_time: string;
  end_time: string;
  price_per_day_pence: number;
  photo_path: string | null;
  photo_alt: string | null;
  logo_path: string | null;
  is_demo?: boolean;
  bookable: boolean;
  days: { date: string; capacity: number; taken: number }[];
};

export function SchoolLogo({ school, logoPath, size = 84 }: { school: string; logoPath: string | null; size?: number }) {
  const url = publicImageUrl(logoPath);
  return (
    <span className="school-logo" style={size !== 84 ? { width: size, height: size } : undefined}>
      {url ? <Image src={url} alt={`${school} logo`} fill sizes={`${size}px`} /> : <span aria-hidden="true">{initials(school)}</span>}
    </span>
  );
}

export function CampCard({ camp, index = 0 }: { camp: CampCardData; index?: number }) {
  const photo = publicImageUrl(camp.photo_path);
  const flagged = camp.days.filter((d) => spaceLevel(d) !== "ok");
  const allFull = camp.days.length > 0 && camp.days.every((d) => spaceLevel(d) === "full");
  return (
    <article className="camp">
      <div className={`camp-img${index % 2 ? " alt" : ""}`}>
        {photo ? (
          <Image src={photo} alt={camp.photo_alt || `Children at ${camp.school}`} fill sizes="(max-width: 760px) 100vw, 760px" />
        ) : (
          <span>Photo coming soon</span>
        )}
        <SchoolLogo school={camp.school} logoPath={camp.logo_path} />
      </div>
      <div className="camp-body">
        <span className="area-tag">{camp.area}{camp.is_demo ? " · Example" : ""}</span>
        <h3>{camp.school}</h3>
        <span className="age">{camp.age_min} to {camp.age_max} Years</span>
        <p><b>{dateRange(camp.days.map((d) => d.date))}</b></p>
        <p>{timeRange(camp.start_time, camp.end_time)} · from {gbp(camp.price_per_day_pence)} per day</p>
        {flagged.length > 0 && (
          <div className="day-flags" aria-label="Days filling up">
            {flagged.map((d) => {
              const left = spacesLeft(d);
              return (
                <span key={d.date} className={`sp ${spaceLevel(d)}`}>
                  {shortDay(d.date)} · {left <= 0 ? "Full" : `${left} left`}
                </span>
              );
            })}
          </div>
        )}
        <div className="areas">
          {camp.bookable && !allFull ? (
            <Link className="area" href={`/book/${camp.slug}`}>Book now</Link>
          ) : (
            <Link className="area" href={`/camps/${camp.slug}`}>{allFull ? "Full: join the waiting list" : "See details"}</Link>
          )}
          <Link className="link" href={`/camps/${camp.slug}`} style={{ alignSelf: "center" }}>
            Camp details<span className="sr-only"> for {camp.school}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
