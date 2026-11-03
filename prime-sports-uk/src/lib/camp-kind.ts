import type { CampKind } from "./types";

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
