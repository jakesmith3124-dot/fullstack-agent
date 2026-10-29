import { getAllContent } from "@/lib/data";
import { CONTACT_EMAIL } from "@/lib/env";
import { RichText } from "./RichText";

/**
 * Legal and policy pages. The owner supplies the wording in admin (Content → Policies).
 * Until a page is confirmed there, the public sees a holding notice, never the draft.
 */
export async function LegalPage({ contentKey, fallbackTitle }: { contentKey: string; fallbackTitle: string }) {
  const item = (await getAllContent()).find((i) => i.key === contentKey) as
    | { data: { title: string; body: string; updated?: string } }
    | undefined;
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Policies</div>
          <h1>{item?.data.title ?? fallbackTitle}</h1>
          {item?.data.updated && <p>Last updated {item.data.updated}</p>}
        </div>
      </div>
      <section>
        <div className="wrap prose">
          {item ? (
            <RichText text={item.data.body} />
          ) : (
            <>
              <p className="draft-banner">This page is being finalised.</p>
              <p>
                Our {fallbackTitle.toLowerCase()} is being finalised. If you have any questions in the meantime, email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
