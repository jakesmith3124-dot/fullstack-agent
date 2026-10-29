// Formatting helpers. UK English, GBP and the Europe/London clock everywhere.

export const TZ = "Europe/London";

/** £22, £22.50, £1,200 */
export function gbp(pence: number): string {
  const pounds = pence / 100;
  const whole = Number.isInteger(pounds);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}

/** Today's date in London as YYYY-MM-DD. */
export function todayLondon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Parse YYYY-MM-DD as a calendar date (noon UTC avoids DST edge cases). */
export function parseDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return parseDate(iso).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
}

/** "Mon 15 Feb" */
export const shortDay = (iso: string) => fmtDate(iso, { weekday: "short", day: "numeric", month: "short" });
/** "15 February 2027" */
export const longDate = (iso: string) => fmtDate(iso, { day: "numeric", month: "long", year: "numeric" });

/** "Tue 27 – Thu 29 October" style range for a list of ISO dates. */
export function dateRange(dates: string[]): string {
  if (!dates.length) return "";
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return fmtDate(first, { weekday: "short", day: "numeric", month: "long" });
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const a = fmtDate(first, sameMonth ? { weekday: "short", day: "numeric" } : { weekday: "short", day: "numeric", month: "long" });
  const b = fmtDate(last, { weekday: "short", day: "numeric", month: "long" });
  return `${a} – ${b}`;
}

/** "09:00:00" -> "9am", "15:30" -> "3:30pm" */
export function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export function timeRange(start: string, end: string): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

export function fmtDateTime(ts: string | Date): string {
  return new Date(ts).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function fmtClock(ts: string | Date): string {
  return new Date(ts).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** Age in whole years on a given date. */
export function ageOn(dob: string, onIso: string): number {
  const d = parseDate(dob);
  const r = parseDate(onIso);
  let age = r.getUTCFullYear() - d.getUTCFullYear();
  const m = r.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && r.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export function initials(name: string, max = 3): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Z]/.test(w));
  return (words.length ? words : name.split(/\s+/)).slice(0, max).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
