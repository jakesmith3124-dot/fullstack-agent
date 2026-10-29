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

const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:54324";

/** Signs in through the real magic-link flow, reading the email from the local Mailpit inbox. */
export async function signIn(page: Page, email: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  const since = Date.now();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  let link: string | null = null;
  for (let i = 0; i < 30 && !link; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const json = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const msg = json.messages.find((m) => new Date(m.Created).getTime() >= since - 5000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { Text: string; HTML: string };
      link = (full.HTML.match(/href="([^"]*verify[^"]*)"/)?.[1] ?? full.Text.match(/(http\S*verify\S*)/)?.[1] ?? null)?.replace(/&amp;/g, "&") ?? null;
    }
    if (!link) await page.waitForTimeout(500);
  }
  if (!link) throw new Error(`No magic link email for ${email}`);
  await page.goto(link);
}
