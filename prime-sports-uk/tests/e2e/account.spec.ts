import { expect, test } from "@playwright/test";
import { CAMP, fillChild, fillParent, payAndExpectConfirmed, pickDays, signIn, uniqueEmail } from "./helpers";

test("a guest booking appears in the parent's account after signing in", async ({ page }) => {
  const email = uniqueEmail("account");
  await page.goto(CAMP);
  await pickDays(page, [/16 February 2027/]);
  await fillChild(page, 0, { first: "Oscar", last: "Account", dob: "2017-07-07", medical: "Asthma, inhaler in bag" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillParent(page, email);
  const ref = await payAndExpectConfirmed(page);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByText(ref)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Oscar Account" })).toBeVisible();
  await expect(page.getByText("Medical or allergy info")).toBeVisible();

  // Edit the child's details
  await page.getByRole("link", { name: "Edit details" }).click();
  await page.getByLabel("Allergies").fill("Peanuts");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\. Staff will see these details/)).toBeVisible();

  // Rebook: saved children appear as a quick pick
  await page.goto(CAMP);
  await pickDays(page, [/17 February 2027/]);
  await page.getByRole("button", { name: /Oscar Account/ }).click();
  await expect(page.getByLabel("Allergies")).toHaveValue("Peanuts");

  // Download my data
  const download = page.waitForEvent("download");
  await page.goto("/account");
  await page.getByRole("link", { name: "Download my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("prime-sports-uk-my-data.json");
});
