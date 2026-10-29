import { expect, test } from "@playwright/test";
import { CAMP, fillChild, fillParent, payAndExpectConfirmed, uniqueEmail } from "./helpers";
import { adminDb, env } from "./support";

test("Prime Camps early access sign-up is saved with consent", async ({ page }) => {
  const email = uniqueEmail("ea");
  await page.goto("/prime-camps#register");
  const form = page.locator("#register form");
  await form.getByLabel("Your first name").fill("Early");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Your area").selectOption("Halifax");
  await form.getByLabel("Children's ages").fill("6 and 9");
  await form.getByRole("button", { name: "Get early access" }).click();
  await expect(form.getByRole("alert")).toContainText("Tick the box");
  await expect(form.getByLabel("Your first name")).toHaveValue("Early"); // input kept after an error
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Get early access" }).click();
  await expect(page.getByText("You're on the list")).toBeVisible();
  const { data } = await adminDb().from("early_access_signups").select("area, marketing_consent, consent_at").eq("email", email).single();
  expect(data).toMatchObject({ area: "Halifax", marketing_consent: true });
  expect(data!.consent_at).toBeTruthy();
});

test("G.O.A.T waiting list and school enquiry forms work", async ({ page }) => {
  await page.goto("/goat#waiting-list");
  const goat = page.locator("#waiting-list form");
  await goat.getByLabel("Your first name").fill("Gary");
  await goat.getByLabel("Email", { exact: true }).fill(uniqueEmail("goat"));
  await goat.getByLabel("Your area").selectOption("Bradford");
  await goat.getByLabel("Player's age").fill("9");
  await goat.getByRole("checkbox").check();
  await goat.getByRole("button", { name: "Join the waiting list" }).click();
  await expect(page.getByText("You're on the waiting list")).toBeVisible();

  await page.goto("/schools#enquire");
  const school = page.locator("#enquire form");
  await school.getByLabel("School name").fill("Test Prep School");
  await school.getByLabel("Your name").fill("Pat Head");
  await school.getByLabel("Email", { exact: true }).fill(uniqueEmail("school"));
  await school.getByRole("checkbox", { name: "After-school club" }).check();
  await school.getByRole("checkbox", { name: /happy for Prime Sports UK to contact me/ }).check();
  await school.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByText("Thanks, we've got your enquiry")).toBeVisible();
});

test("the daily job takes instalments that are due", async ({ page, request }) => {
  await page.goto(CAMP);
  await page.getByRole("button", { name: "Select all days" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillChild(page, 0, { first: "Ivy", last: "Instalment", dob: "2017-02-02" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, uniqueEmail("cron"));
  await page.getByRole("radio", { name: /Pay in 2 monthly instalments/ }).click();
  const ref = await payAndExpectConfirmed(page);

  const db = adminDb();
  const { data: booking } = await db.from("bookings").select("id, total_pence").eq("ref", ref).single();
  // Pretend the second payment date has arrived.
  await db.from("instalments").update({ due_date: new Date().toISOString().slice(0, 10) }).eq("booking_id", booking!.id).eq("seq", 2);
  const res = await request.get("/api/cron/daily", { headers: { authorization: `Bearer ${env("CRON_SECRET")}` } });
  expect(res.ok()).toBeTruthy();
  const { data: after } = await db.from("bookings").select("amount_paid_pence").eq("id", booking!.id).single();
  expect(after!.amount_paid_pence).toBe(booking!.total_pence);
  const unauth = await request.get("/api/cron/daily");
  expect(unauth.status()).toBe(401);
});

test("a full day shows on the camp card and blocks booking past capacity", async ({ page }) => {
  await page.goto("/camps");
  const card = page.locator("article.camp").filter({ hasText: "Bowling Green Academy" }).filter({ hasText: "Example" });
  await expect(card.getByText(/Thu 18 Feb · Full/)).toBeVisible();
  await expect(card.getByText(/Fri 19 Feb · \d left/)).toBeVisible();
});

test("public pages never show unconfirmed claims", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Fully qualified coaches")).toHaveCount(0);
  await page.goto("/prime-camps");
  await expect(page.getByRole("heading", { name: "Minis" })).toHaveCount(0);
  await expect(page.getByText("Drop-off and free play")).toHaveCount(0);
  await page.goto("/faq");
  await expect(page.getByText("Is there a first aider on site?")).toHaveCount(0);
  await page.goto("/booking-terms");
  await expect(page.getByText("This page is being finalised.")).toBeVisible();
  await expect(page.getByText("OWNER TO SUPPLY")).toHaveCount(0);
});
