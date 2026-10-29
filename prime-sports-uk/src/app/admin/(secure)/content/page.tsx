import { addContent, deleteContent, uploadContentImage } from "@/app/actions/admin-content";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { requireOwner } from "@/lib/auth";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { ContentItem } from "@/lib/types";
import { ContentItemForm } from "./ContentItemForm";

const SECTIONS: [string, string][] = [
  ["home", "Homepage text"], ["home.badges", "Homepage hero badges"], ["home.facts", "Homepage facts strip"], ["images", "Page photos"],
  ["safety", "Safety: heading"], ["safety.tiles", "Safety & trust tiles"], ["team", "Team: heading"], ["team.members", "Team members"],
  ["faq.book", "FAQ: Booking & payments"], ["faq.day", "FAQ: On the day"], ["faq.health", "FAQ: Health & safety"], ["faq.more", "FAQ: Everything else"],
  ["pc.groups", "Prime Camps: age groups"], ["pc", "Prime Camps: example day"], ["pc.info", "Prime Camps: before you book"], ["pc.faq", "Prime Camps: FAQ"],
  ["goat.info", "G.O.A.T: how it will work"], ["goat", "G.O.A.T: details"], ["legal", "Policy pages"],
];
const ADDABLE = new Set(["faq.book", "faq.day", "faq.health", "faq.more", "pc.faq", "team.members", "safety.tiles"]);

export default async function ContentAdmin() {
  await requireOwner("/admin/content");
  const supabase = await createClient();
  const { data } = await supabase.from("content_items").select("*").order("sort_order");
  const items = (data ?? []) as ContentItem[];
  const unconfirmed = items.filter((i) => !i.confirmed).length;
  return (
    <>
      <h1 className="admin-title">Content</h1>
      <p className="muted">Edit the words and photos on the website. Items outlined in <b style={{ color: "#d9731a" }}>orange</b> are not confirmed yet and stay hidden from the public until you tick &ldquo;Confirmed&rdquo;. {unconfirmed} item{unconfirmed === 1 ? "" : "s"} to confirm.</p>
      <nav className="chips" aria-label="Sections">{SECTIONS.map(([s, l]) => <a key={s} className="chip" href={`#s-${s}`}>{l}</a>)}</nav>
      {SECTIONS.map(([section, label]) => {
        const list = items.filter((i) => i.section === section);
        if (!list.length && !ADDABLE.has(section)) return null;
        return (
          <section key={section} id={`s-${section}`} style={{ padding: 0, display: "grid", gap: ".8rem" }}>
            <div className="row"><h2>{label}</h2>{ADDABLE.has(section) && <form action={addContent.bind(null, section)}><button className="btn small ghost">+ Add</button></form>}</div>
            {list.map((item) => {
              const d = item.data as Record<string, unknown>;
              const imageField = "path" in d ? "path" : "photo" in d ? "photo" : null;
              return (
                <div key={item.id} id={item.key} style={{ display: "grid", gap: ".6rem" }}>
                  <ContentItemForm item={item} deletable={ADDABLE.has(section)} onDelete={ADDABLE.has(section) ? deleteContent.bind(null, item.id) : undefined} />
                  {imageField && (
                    <ImageUpload
                      action={uploadContentImage.bind(null, item.id, imageField)}
                      aspect={imageField === "photo" ? 1 : item.key === "home.hero_image" ? 4 / 5 : 5 / 4}
                      label={`${String(d.label ?? d.name ?? "Photo")}: upload photo`}
                      altLabel={imageField === "path" ? "Photo description" : undefined}
                      defaultAlt={String(d.alt ?? "")}
                      previewUrl={publicImageUrl(d[imageField] as string | null)}
                    />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
