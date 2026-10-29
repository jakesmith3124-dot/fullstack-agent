import type { ContentItem } from "@/lib/types";

export function FaqList({ items }: { items: ContentItem<{ q: string; a: string }>[] }) {
  if (!items.length) return null;
  return (
    <div className="faqs">
      {items.map((f) => (
        <details key={f.key}>
          <summary>{f.data.q}</summary>
          <p>{f.data.a}</p>
        </details>
      ))}
    </div>
  );
}
