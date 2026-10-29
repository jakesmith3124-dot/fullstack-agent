import { expect, test } from "@playwright/test";
import { CAMP, SOON_CAMP, fillChild, fillParent, payAndExpectConfirmed, pickDays, uniqueEmail } from "./helpers";

test("single child books two days and pays in full", async ({ page }) => {
  await page.goto(CAMP);
  await pickDays(page, [/15 February 2027/, /16 February 2027/]);
  await fillChild(page, 0, { first: "Lily", last: "Test", dob: "2019-05-01", medical: "Nut allergy, EpiPen in bag" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("single"));
  await expect(page.locator(".basket .line.total")).toContainText("£44");
  const ref = await payAndExpectConfirmed(page);
  expect(ref).toMatch(/^PS-[A-Z0-9]{6}$/);
});

test("siblings get the sibling discount", async ({ page }) => {
  await page.goto(CAMP);
  await pickDays(page, [/15 February 2027/]);
  await fillChild(page, 0, { first: "Sam", last: "Test", dob: "2017-03-01" });
  await page.getByRole("button", { name: "+ Add another child" }).click();
  await fillChild(page, 1, { first: "Ava", last: "Test", dob: "2018-03-01", photo: "no" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("siblings"));
  await expect(page.locator(".basket .line.disc")).toContainText("Sibling discount");
  await expect(page.locator(".basket .line.total")).toContainText("£41.80"); // £44 less 10% of £22
  await payAndExpectConfirmed(page);
});

test("instalments show a schedule and only the first payment is taken", async ({ page }) => {
  await page.goto(CAMP);
  await page.getByRole("button", { name: "Select all days" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillChild(page, 0, { first: "Max", last: "Test", dob: "2016-06-01" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("instalments"));
  await page.getByRole("radio", { name: /Pay in 3 monthly instalments/ }).click();
  await expect(page.locator(".sched")).toContainText("Your payment schedule");
  await expect(page.locator(".basket .today")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /authorise the scheduled instalment payments/ })).toBeVisible();
  await payAndExpectConfirmed(page);
  await expect(page.getByText(/remaining 2 instalments will be taken automatically/)).toBeVisible();
});

test("instalments are blocked when the camp starts too soon", async ({ page }) => {
  await page.goto(SOON_CAMP);
  await pickDays(page, [/21 December 2026/]);
  await fillChild(page, 0, { first: "Zoe", last: "Test", dob: "2018-01-01" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("soon"));
  await expect(page.getByRole("radio", { name: /Pay in 3 monthly instalments/ })).toBeDisabled();
});

test("a discount code is applied", async ({ page }) => {
  await page.goto(CAMP);
  await pickDays(page, [/16 February 2027/]);
  await fillChild(page, 0, { first: "Ella", last: "Test", dob: "2018-09-09" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("code"));
  await page.getByLabel("Discount code").fill("NOTACODE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("That code isn't valid")).toBeVisible();
  await page.getByLabel("Discount code").fill("test5");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".basket .line.total")).toContainText("£17");
  await payAndExpectConfirmed(page);
});

test("full days can't be picked and offer a waiting list", async ({ page }) => {
  await page.goto(CAMP);
  await expect(page.getByRole("button", { name: /18 February 2027, full/ })).toBeDisabled();
  await page.getByRole("button", { name: /Join the waiting list/ }).click();
  await page.getByLabel("Your name").fill("Waiting Parent");
  await page.getByLabel("Email").fill(uniqueEmail("waiting"));
  await page.getByRole("button", { name: "Join waiting list" }).click();
  await expect(page.getByText("You're on the waiting list")).toBeVisible();
});

test("children outside the age range are rejected with their age", async ({ page }) => {
  await page.goto(CAMP);
  await pickDays(page, [/15 February 2027/]);
  await fillChild(page, 0, { first: "Tiny", last: "Test", dob: "2023-06-01" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("#bk-err")).toContainText("Tiny will be 3 on the first day. This camp is for ages 4–11.");
});

test("a declined card shows an error and nothing is confirmed", async ({ page }) => {
  test.skip(!!process.env.STRIPE_SECRET_KEY, "Uses the local fake-payment switch");
  await page.goto(CAMP);
  await pickDays(page, [/17 February 2027/]);
  await fillChild(page, 0, { first: "Declined", last: "Test", dob: "2018-01-01" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("declined"));
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("checkbox", { name: "Simulate a declined card" }).check();
  await page.getByRole("button", { name: /Pay .* now/ }).click();
  await expect(page.locator("#bk-err")).toContainText("Your card was declined");
  await expect(page.getByRole("heading", { name: "You're booked in!" })).toHaveCount(0);
});
