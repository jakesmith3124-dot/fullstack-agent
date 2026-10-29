import { expect, test, type Page } from "@playwright/test";
import { fillParent, payAndExpectConfirmed, signIn, uniqueEmail } from "./helpers";
import { adminDb, passMfa } from "./support";

// One full camp day: the owner sets up a camp, a parent books, staff run the register,
// and the parent follows along in the Prime Camps app.
test.describe.serial("owner, staff and parent app on a camp day", () => {
  const ownerEmail = uniqueEmail("owner");
  const staffEmail = uniqueEmail("staff");
  const parentEmail = uniqueEmail("parent");
  const school = `E2E School ${Date.now() % 100000}`;
  const todayLong = new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
  let ownerSecret = "";
  let staffSecret = "";
  let passCode = "";

  test.beforeAll(async () => {
    const db = adminDb();
    const { data, error } = await db.auth.admin.createUser({ email: ownerEmail, email_confirm: true });
    if (error) throw error;
    await db.from("profiles").update({ role: "owner", full_name: "Test Owner" }).eq("id", data.user!.id);
  });

  async function fresh(page: Page) {
    await page.context().clearCookies();
  }

  test("owner signs in with 2FA and sets up a camp running today", async ({ page }) => {
    await signIn(page, ownerEmail, "/admin");
    ownerSecret = await passMfa(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto("/admin/camps/new");
    await page.getByLabel("School or venue name").fill(school);
    await page.getByLabel("Area / town").fill("Halifax");
    await page.getByLabel("Price per day (£)").fill("20");
    await page.getByLabel(/Day timetable/).fill("9:00 | Drop-off | Signed in by name\n12:00 | Lunch | Packed lunch\n3:00 | Collection | Signed out to an approved adult");
    await page.getByLabel(/Venue, dates and prices are confirmed/).check();
    await page.getByRole("button", { name: "Create camp" }).click();
    await expect(page.getByText("Camp created")).toBeVisible();

    const days = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Days and places" }) });
    await days.getByLabel("From").fill(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }));
    await days.getByLabel("Places per day").fill("10");
    await days.getByLabel("Weekdays only").uncheck();
    await days.getByRole("button", { name: "Add days" }).click();
    await expect(days.getByText("Added 1 day.")).toBeVisible();

    const logo = page.locator("form.card").filter({ hasText: "School logo (black circle)" });
    await logo.getByLabel("Choose image").setInputFiles("tests/fixtures/logo-white-bg.png");
    await logo.getByRole("button", { name: "Upload" }).click();
    await expect(logo.getByText("Logo processed and saved.")).toBeVisible({ timeout: 20_000 });
  });

  test("owner adds a staff member and assigns them to the camp", async ({ page }) => {
    await signIn(page, ownerEmail, "/admin/staff");
    await passMfa(page, ownerSecret);
    const add = page.locator("form.card").filter({ hasText: "Add a staff member" });
    await add.getByLabel("Name").fill("Coach Test");
    await add.getByLabel("Email").fill(staffEmail);
    await add.getByRole("button", { name: "Add and email them" }).click();
    await expect(add.getByText(`${staffEmail} added as staff.`)).toBeVisible();
    const card = page.locator("div.card").filter({ hasText: staffEmail });
    await card.locator("select[name=camp_id]").selectOption({ label: `${school} (Halifax)` });
    await card.getByRole("button", { name: "Assign" }).click();
    await expect(card.getByText(`${school} · every day`)).toBeVisible();
  });

  test("a parent books two children for today", async ({ page }) => {
    await fresh(page);
    const db = adminDb();
    const { data } = await db.from("camps").select("slug").eq("school", school).single();
    await page.goto(`/book/${data!.slug}`);
    await page.getByRole("button", { name: new RegExp(todayLong) }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const kid = async (i: number, first: string, photo: "yes" | "no", medical?: string) => {
      const card = page.locator(".bk-stage > .card").filter({ has: page.getByLabel("First name") }).nth(i);
      await card.getByLabel("First name").fill(first);
      await card.getByLabel("Surname").fill("Daytest");
      await card.getByLabel("Date of birth").fill("2018-04-04");
      if (medical) await card.getByLabel("Medical conditions").fill(medical);
      await card.getByLabel("Who can collect them?").fill("Mum, Grandad");
      await card.getByRole("button", { name: photo === "yes" ? "Yes, that's fine" : "No photos please" }).click();
    };
    await kid(0, "Mia", "yes", "Asthma, inhaler in bag");
    await page.getByRole("button", { name: "+ Add another child" }).click();
    await kid(1, "Leo", "no");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await fillParent(page, parentEmail);
    await payAndExpectConfirmed(page);
  });

  test("staff sign in with 2FA, see medical flags and sign a child in", async ({ page }) => {
    await fresh(page);
    await signIn(page, staffEmail, "/admin/register");
    staffSecret = await passMfa(page);
    await expect(page.getByRole("heading", { name: "My registers" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/ })).toHaveCount(0);
    await page.getByRole("link", { name: new RegExp(school) }).click();
    const mia = page.locator(".reg-row").filter({ hasText: "Mia Daytest" });
    const leo = page.locator(".reg-row").filter({ hasText: "Leo Daytest" });
    await expect(mia.locator(".tag.med")).toContainText("Asthma");
    await expect(leo.getByText("No photos")).toBeVisible();
    await mia.getByRole("button", { name: "Sign in" }).click();
    await expect(mia.getByText(/^In /)).toBeVisible();

    // Staff can't open owner pages.
    await page.goto("/admin/camps");
    await expect(page).toHaveURL(/\/admin\/register/);
  });

  test("the parent app shows the sign-in, a pickup pass and sends running late", async ({ page }) => {
    await fresh(page);
    await signIn(page, parentEmail, "/app");
    await page.getByRole("button", { name: "Mia" }).click();
    await expect(page.getByRole("heading", { name: "Mia is checked in" })).toBeVisible();
    await expect(page.getByText("Drop-off")).toBeVisible();
    await page.getByRole("link", { name: "Pickup", exact: true }).click();
    await expect(page.getByRole("img", { name: /Pickup pass QR code for Mia/ })).toBeVisible();
    passCode = (await page.locator(".code").textContent())!.trim();
    await page.getByRole("button", { name: /Grandad/ }).click();
    await expect(page.getByText("Grandad is collecting")).toBeVisible();
    await page.getByRole("button", { name: "20 mins" }).click();
    await page.getByRole("button", { name: "Tell the coaches" }).click();
    await expect(page.getByText("Coaches told you're 20 mins late")).toBeVisible();
  });

  test("staff acknowledge the late message, post a photo and release Mia with her pass", async ({ page }) => {
    await fresh(page);
    await signIn(page, staffEmail, "/admin/register");
    await passMfa(page, staffSecret);
    await page.getByRole("link", { name: new RegExp(school) }).click();
    const late = page.locator(".card").filter({ hasText: "Running late" }).first();
    await expect(late).toContainText("Mia Daytest");
    await late.getByRole("button", { name: "Got it" }).click();

    const post = page.locator("#post");
    await post.getByLabel("Title").fill("Archery is underway");
    await post.getByLabel("Message").fill("First arrows of the day.");
    await post.getByLabel(/Photos/).setInputFiles("tests/fixtures/photo.jpg");
    await expect(post.getByRole("checkbox", { name: /Leo Daytest \(no photos\)/ })).toBeDisabled();
    await post.getByRole("checkbox", { name: "Mia Daytest" }).check();
    await post.getByRole("button", { name: "Post" }).click();
    await expect(post.getByText(/Confirm that only children with photo consent/)).toBeVisible();
    await post.getByRole("checkbox", { name: /no child without photo consent/ }).check();
    await post.getByRole("button", { name: "Post" }).click();
    await expect(post.getByText("Posted to the parent app.")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Scan pickup pass" }).click();
    await page.getByLabel("Or type the pass code").fill(passCode);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Parent says Grandad is collecting.")).toBeVisible();
    await page.getByRole("button", { name: "Release to Grandad" }).click();
    await expect(page.getByText("Mia signed out to Grandad.")).toBeVisible();
  });

  test("the parent sees the photo and that Mia was collected", async ({ page }) => {
    await fresh(page);
    await signIn(page, parentEmail, "/app/updates");
    await expect(page.getByRole("heading", { name: "Archery is underway" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Archery is underway, photo 1/ })).toBeVisible();
    await page.getByRole("link", { name: "Today", exact: true }).click();
    await page.getByRole("button", { name: "Mia" }).click();
    await expect(page.getByRole("heading", { name: "Mia has been collected" })).toBeVisible();
    await expect(page.getByText(/Collected by Grandad/)).toBeVisible();
  });

  test("an unconfirmed safety claim stays hidden until the owner confirms it", async ({ page }) => {
    await fresh(page);
    await page.goto("/safety");
    await expect(page.getByRole("heading", { name: "First aid on site" })).toHaveCount(0);
    await signIn(page, ownerEmail, "/admin/content");
    await passMfa(page, ownerSecret);
    const tile = page.locator("form.card").filter({ has: page.locator('input[value="First aid on site"]') });
    await expect(tile).toHaveClass(/unconfirmed/);
    await tile.getByRole("checkbox", { name: "Confirmed (show publicly)" }).check();
    await tile.getByRole("button", { name: "Save" }).click();
    await expect(tile.getByText("Saved and live.")).toBeVisible();
    await page.goto("/safety");
    await expect(page.getByRole("heading", { name: "First aid on site" })).toBeVisible();
    // Put it back so the demo data stays honest.
    await adminDb().from("content_items").update({ confirmed: false }).eq("key", "safety.first_aid");
  });
});
