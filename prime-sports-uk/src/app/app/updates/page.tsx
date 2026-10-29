import { requireViewer } from "@/lib/auth";
import { addDays } from "@/lib/pricing";
import { todayLondon } from "@/lib/format";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { UpdatesView, type FeedPost } from "./UpdatesView";

export const metadata = { title: "Live updates" };
export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  await requireViewer("/app/updates");
  const supabase = await createClient();
  // RLS only returns posts for camp days this parent's children are booked on.
  const { data } = await supabase
    .from("camp_posts")
    .select("id, kind, title, body, photo_paths, tagged_child_ids, group_name, created_at, camps(school)")
    .gte("created_at", `${addDays(todayLondon(), -14)}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(60);
  const posts = (data ?? []) as unknown as { id: string; kind: string; title: string; body: string | null; photo_paths: string[]; tagged_child_ids: string[]; group_name: string | null; created_at: string; camps: { school: string } }[];

  // Consent is re-checked when photos are shown, in case a parent has since withdrawn it.
  const db = createAdminClient();
  const tagged = [...new Set(posts.flatMap((p) => p.tagged_child_ids))];
  const { data: consents } = tagged.length ? await db.from("children").select("id, photo_consent").in("id", tagged) : { data: [] };
  const noConsent = new Set((consents ?? []).filter((c) => !c.photo_consent).map((c) => c.id));
  const feed: FeedPost[] = [];
  for (const p of posts) {
    const allowed = !p.tagged_child_ids.some((id) => noConsent.has(id));
    let photos: string[] = [];
    if (allowed && p.photo_paths.length) {
      const { data: signed } = await db.storage.from("camp-photos").createSignedUrls(p.photo_paths, 60 * 10);
      photos = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
    }
    if (p.kind === "photo" && !photos.length) continue;
    feed.push({ id: p.id, kind: p.kind, title: p.title, body: p.body, photos, group: p.group_name, camp: p.camps.school, at: p.created_at });
  }
  return <UpdatesView posts={feed} />;
}
