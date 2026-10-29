import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, instalmentOptions, instalmentSchedule, quote, spaceLevel, DEFAULT_INSTALMENT_RULES } from "../../src/lib/pricing";
import { ageOn, dateRange, gbp, timeRange } from "../../src/lib/format";

test("single child, three days", () => {
  const q = quote({ pricePerDayPence: 2200, campDayCount: 3, selectedDayCount: 3, childCount: 1, siblingPct: 10 });
  assert.equal(q.totalPence, 6600);
  assert.equal(q.siblingDiscountPence, 0);
});

test("sibling discount applies to each additional child", () => {
  const q = quote({ pricePerDayPence: 2200, campDayCount: 3, selectedDayCount: 2, childCount: 3, siblingPct: 10 });
  assert.equal(q.subtotalPence, 13200);
  assert.equal(q.siblingDiscountPence, 880); // 10% of 4400 x 2
  assert.equal(q.totalPence, 12320);
});

test("percentage code applies after the sibling discount", () => {
  const q = quote({
    pricePerDayPence: 2000, campDayCount: 5, selectedDayCount: 1, childCount: 2, siblingPct: 10,
    code: { code: "EARLYBIRD", kind: "percent", value: 10 },
  });
  assert.equal(q.siblingDiscountPence, 200);
  assert.equal(q.codeDiscountPence, 380);
  assert.equal(q.totalPence, 3420);
});

test("fixed code never takes the total below zero", () => {
  const q = quote({
    pricePerDayPence: 1500, campDayCount: 3, selectedDayCount: 1, childCount: 1, siblingPct: 10,
    code: { code: "FIVER", kind: "fixed", value: 5000 },
  });
  assert.equal(q.totalPence, 0);
});

test("full-week price applies only when every day is booked", () => {
  const base = { pricePerDayPence: 2500, fullWeekPricePence: 11000, campDayCount: 5, childCount: 1, siblingPct: 0 };
  assert.equal(quote({ ...base, selectedDayCount: 5 }).totalPence, 11000);
  assert.equal(quote({ ...base, selectedDayCount: 4 }).totalPence, 10000);
});

test("months clamp at the end of shorter months", () => {
  assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonths("2026-11-15", 2), "2027-01-15");
});

test("instalments must finish at least 7 days before the camp", () => {
  const rules = DEFAULT_INSTALMENT_RULES;
  assert.deepEqual(instalmentOptions("2026-11-01", "2027-02-15", rules), [2, 3]);
  // Booking on 10 Dec, the third payment lands on 10 Feb.
  assert.deepEqual(instalmentOptions("2026-12-10", "2027-02-17", rules), [2, 3]); // exactly 7 days before
  assert.deepEqual(instalmentOptions("2026-12-10", "2027-02-16", rules), [2]); // only 6 days before
  assert.deepEqual(instalmentOptions("2027-02-01", "2027-02-15", rules), []);
  assert.deepEqual(instalmentOptions("2026-11-01", "2027-02-15", { ...rules, enabled: false }), []);
});

test("instalment schedule adds up and puts odd pennies first", () => {
  const s = instalmentSchedule(10000, 3, "2026-11-01");
  assert.deepEqual(s.map((p) => p.amountPence), [3334, 3333, 3333]);
  assert.deepEqual(s.map((p) => p.dueDate), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.equal(s.reduce((a, p) => a + p.amountPence, 0), 10000);
});

test("space levels: green, amber at 8 or fewer, red when full", () => {
  assert.equal(spaceLevel({ capacity: 30, taken: 10 }), "ok");
  assert.equal(spaceLevel({ capacity: 30, taken: 22 }), "low");
  assert.equal(spaceLevel({ capacity: 30, taken: 30 }), "full");
});

test("formatting", () => {
  assert.equal(gbp(2200), "£22");
  assert.equal(gbp(1234), "£12.34");
  assert.equal(ageOn("2018-02-16", "2027-02-15"), 8);
  assert.equal(ageOn("2018-02-15", "2027-02-15"), 9);
  assert.equal(dateRange(["2026-10-27", "2026-10-29", "2026-10-28"]), "Tue 27 – Thu 29 October");
  assert.equal(timeRange("09:00:00", "15:00:00"), "9am – 3pm");
});
