import { expect, type Page } from "@playwright/test";

export const CAMP = "/book/example-bowling-green-february-2027";
export const SOON_CAMP = "/book/example-thornton-christmas-2026";

export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
}

export async function pickDays(page: Page, labels: RegExp[]) {
  for (const l of labels) await page.getByRole("button", { name: l }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

export async function fillChild(page: Page, i: number, c: { first: string; last: string; dob: string; photo?: "yes" | "no"; medical?: string }) {
  const card = page.locator(".bk-stage > .card").filter({ has: page.getByLabel("First name") }).nth(i);
  await card.getByLabel("First name").fill(c.first);
  await card.getByLabel("Surname").fill(c.last);
  await card.getByLabel("Date of birth").fill(c.dob);
  if (c.medical) await card.getByLabel("Medical conditions").fill(c.medical);
  await card.getByLabel("Who can collect them?").fill("Mum, Grandad");
  await card.getByRole("button", { name: c.photo === "no" ? "No photos please" : "Yes, that's fine" }).click();
}

export async function fillParent(page: Page, email: string) {
  await page.getByLabel("Full name").fill("Test Parent");
  await page.getByLabel("Mobile number").fill("07700 900123");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Grandma Test");
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("07700 900456");
  await page.getByRole("button", { name: "Continue to payment" }).click();
}

export async function payAndExpectConfirmed(page: Page) {
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: /^(Pay .* now|Confirm booking)$/ }).click();
  await expect(page.getByRole("heading", { name: "You're booked in!" })).toBeVisible({ timeout: 30_000 });
  return (await page.locator(".ref").textContent())!.trim();
}
