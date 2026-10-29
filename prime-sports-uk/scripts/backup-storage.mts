// Downloads every file in the Supabase storage buckets. Used by scripts/backup.sh.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const out = process.argv[2] ?? "backups/storage";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function walk(bucket: string, prefix = ""): Promise<string[]> {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  const files: string[] = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) files.push(path);
    else files.push(...(await walk(bucket, path)));
  }
  return files;
}

for (const bucket of ["site", "originals", "camp-photos"]) {
  const files = await walk(bucket);
  for (const f of files) {
    const { data, error } = await db.storage.from(bucket).download(f);
    if (error || !data) continue;
    const target = join(out, bucket, f);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
  }
  console.log(`✓ ${bucket}: ${files.length} files`);
}
