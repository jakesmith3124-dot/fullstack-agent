// Creates (or promotes) the owner account. Usage: OWNER_EMAIL=you@example.com npm run seed:owner
// The owner then signs in at /login and sets up two-step sign-in on first visit to /admin.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.OWNER_EMAIL || "").toLowerCase().trim();
if (!url || !key || !email) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_EMAIL");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
let id = existing?.id as string | undefined;
if (!id) {
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  id = data.user!.id;
}
const { error } = await db.from("profiles").update({ role: "owner" }).eq("id", id);
if (error) throw error;
console.log(`✓ ${email} is an owner. Sign in at /login, then open /admin to set up two-step sign-in.`);
