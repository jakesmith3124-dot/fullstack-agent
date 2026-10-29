// Pricing, discounts and instalment rules. Pure functions shared by the browser (to show the
// basket) and the server (which always recalculates before taking money).
import { isoDate, parseDate } from "./format";

export type DiscountCode = { id?: string; code: string; label?: string | null; kind: "percent" | "fixed"; value: number };

export type QuoteInput = {
  pricePerDayPence: number;
  fullWeekPricePence?: number | null;
  /** Number of bookable days the camp runs. Used for the full-week price. */
  campDayCount: number;
  selectedDayCount: number;
  childCount: number;
  siblingPct: number;
  code?: DiscountCode | null;
};

export type Quote = {
  perChildPence: number;
  usesFullWeekPrice: boolean;
  subtotalPence: number;
  siblingDiscountPence: number;
  codeDiscountPence: number;
  totalPence: number;
};

export function quote(input: QuoteInput): Quote {
  const days = Math.max(0, input.selectedDayCount);
  const kids = Math.max(0, input.childCount);
  const usesFullWeekPrice =
    !!input.fullWeekPricePence && input.campDayCount > 1 && days === input.campDayCount &&
    input.fullWeekPricePence < input.pricePerDayPence * days;
  const perChildPence = usesFullWeekPrice ? input.fullWeekPricePence! : input.pricePerDayPence * days;
  const subtotalPence = perChildPence * kids;
  const siblingDiscountPence = kids > 1 ? Math.round((perChildPence * (kids - 1) * input.siblingPct) / 100) : 0;
  const afterSibling = subtotalPence - siblingDiscountPence;
  let codeDiscountPence = 0;
  if (input.code && afterSibling > 0) {
    codeDiscountPence =
      input.code.kind === "percent"
        ? Math.round((afterSibling * Math.min(100, input.code.value)) / 100)
        : Math.min(input.code.value, afterSibling);
  }
  return {
    perChildPence,
    usesFullWeekPrice,
    subtotalPence,
    siblingDiscountPence,
    codeDiscountPence,
    totalPence: afterSibling - codeDiscountPence,
  };
}

export type InstalmentRules = {
  enabled: boolean;
  min_days_before: number;
  max_count: number;
  retry_days: number;
  max_attempts: number;
  unpaid_flag_days: number;
};

export const DEFAULT_INSTALMENT_RULES: InstalmentRules = {
  enabled: true,
  min_days_before: 7,
  max_count: 3,
  retry_days: 2,
  max_attempts: 3,
  unpaid_flag_days: 3,
};

/** Same day next month(s), clamped to the end of shorter months (31 Jan + 1 = 28 Feb). */
export function addMonths(iso: string, n: number): string {
  const d = parseDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return isoDate(target);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/**
 * Instalment counts (2..max) available for a booking made today: the final payment must fall
 * at least `min_days_before` days before the first camp day.
 */
export function instalmentOptions(todayIso: string, firstCampDayIso: string, rules: InstalmentRules): number[] {
  if (!rules.enabled) return [];
  const latest = addDays(firstCampDayIso, -rules.min_days_before);
  const out: number[] = [];
  for (let n = 2; n <= Math.max(2, rules.max_count); n++) {
    if (addMonths(todayIso, n - 1) <= latest) out.push(n);
  }
  return out;
}

export type ScheduledPayment = { seq: number; dueDate: string; amountPence: number };

/** Equal monthly payments; any odd pennies go on the first payment, taken today. */
export function instalmentSchedule(totalPence: number, n: number, todayIso: string): ScheduledPayment[] {
  const each = Math.floor(totalPence / n);
  const first = totalPence - each * (n - 1);
  return Array.from({ length: n }, (_, i) => ({
    seq: i + 1,
    dueDate: i === 0 ? todayIso : addMonths(todayIso, i),
    amountPence: i === 0 ? first : each,
  }));
}

export type DayAvailability = { capacity: number; taken: number };
export type SpaceLevel = "ok" | "low" | "full";

export function spacesLeft(d: DayAvailability): number {
  return Math.max(0, d.capacity - d.taken);
}

/** Green when plenty, amber at 8 or fewer, red when full. */
export function spaceLevel(d: DayAvailability): SpaceLevel {
  const left = spacesLeft(d);
  return left <= 0 ? "full" : left <= 8 ? "low" : "ok";
}
