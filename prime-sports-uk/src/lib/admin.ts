import "server-only";
import { revalidatePath, updateTag } from "next/cache";

/** After any change that the public site shows: expire cached data and pages immediately. */
export function refreshPublic() {
  updateTag("public");
  revalidatePath("/", "layout");
}

export type ActionResult = { ok: boolean; error?: string; message?: string };

export function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
export function num(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function pounds(fd: FormData, k: string): number | null {
  const n = num(fd, k);
  return n === null ? null : Math.round(n * 100);
}
export function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "on" || fd.get(k) === "true";
}

/** Converts a London local date-time from an <input type="datetime-local"> into an ISO timestamp. */
export function londonDateTime(value: string): string | null {
  if (!value) return null;
  const guess = new Date(`${value}:00Z`);
  const london = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const offset = london.getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export function toLondonInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
