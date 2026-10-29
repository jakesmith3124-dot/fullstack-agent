// Uploads the school logos from supabase/seed-assets through the logo pipeline and links them
// to the seeded camps. Usage: npm run seed:assets (reads .env.local)
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { processLogo } from "../src/lib/images.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(url, key, { auth: { persistSession: false } });

const LOGOS: Record<string, string> = {
  "Bowling Green Academy": "supabase/seed-assets/school-logo-bowling-green.png",
  "Thornton Primary School": "supabase/seed-assets/school-logo-thornton.png",
};

for (const [school, file] of Object.entries(LOGOS)) {
  const original = await readFile(file);
  const processed = await processLogo(original);
  const base = school.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const logoPath = `logos/${base}.png`;
  const originalPath = `logos/${base}-original.png`;
  const up1 = await db.storage.from("site").upload(logoPath, processed, { contentType: "image/png", upsert: true });
  const up2 = await db.storage.from("originals").upload(originalPath, original, { contentType: "image/png", upsert: true });
  if (up1.error || up2.error) throw new Error((up1.error || up2.error)!.message);
  const { error } = await db.from("camps").update({ logo_path: logoPath, logo_original_path: originalPath }).eq("school", school);
  if (error) throw new Error(error.message);
  console.log(`✓ ${school}`);
}
