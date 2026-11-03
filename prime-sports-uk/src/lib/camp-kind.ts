import { fmtTime } from "./format";
import type { CampKind } from "./types";

type Slot = { date: string; start_time?: string | null };

/** True when a date has more than one session, or sessions start at different times: then every day shows its time. */
export function hasTimeSlots(days: Slot[]): boolean {
  return new Set(days.map((d) => d.date)).size < days.length || new Set(days.map((d) => d.start_time ?? "")).size > 1;
}

export const slotTime = (d: Slot) => (d.start_time ? fmtTime(d.start_time) : "");

/** Wording for holiday camps (booked by the day) and clubs or darts (booked by the week or the term). */
export function kindWords(kind: CampKind | undefined) {
  const weekly = kind === "club" || kind === "darts";
  return {
    weekly,
    noun: kind === "club" ? "club" : kind === "darts" ? "darts sessions" : "holiday camp",
    label: kind === "club" ? "School club" : kind === "darts" ? "Darts" : "Holiday camp",
    unit: weekly ? "session" : "day",
    units: weekly ? "sessions" : "days",
    whole: weekly ? "full term" : "full week",
  };
}
