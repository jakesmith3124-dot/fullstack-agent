import { adminDb } from "./support";

// Removes bookings, children and accounts left by earlier test runs, so places on the
// example camp days don't fill up run after run.
export default async function globalSetup() {
  const db = adminDb();
  const { data: users } = await db.from("profiles").select("id").like("email", "e2e-%@example.com");
  const ids = (users ?? []).map((u) => u.id);
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    await db.from("bookings").delete().in("parent_id", batch);
    await db.from("memberships").delete().in("parent_id", batch);
    await db.from("children").delete().in("parent_id", batch);
    for (const id of batch) await db.auth.admin.deleteUser(id);
  }
  await db.from("waiting_list").delete().like("parent_email", "e2e-%@example.com");
  await db.from("camps").delete().like("school", "E2E School %");
}
