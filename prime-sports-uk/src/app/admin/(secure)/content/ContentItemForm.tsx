"use client";
import { useFormAction } from "@/lib/use-form-action";

import { saveContent } from "@/app/actions/admin-content";
import type { ContentItem } from "@/lib/types";

type Result = { ok: boolean; error?: string; message?: string };
const LABELS: Record<string, string> = {
  eyebrow: "Small heading", title: "Heading", body: "Text", q: "Question", a: "Answer", text: "Message", link_label: "Link text", href: "Link address",
  name: "Name", role: "Role", initials: "Initials (shown until a photo is added)", icon: "Icon", ages: "Ages", items: "Items (one per line)",
  paragraphs: "Paragraphs (one per line)", label: "Label", alt: "Photo description", updated: "Last updated",
};
const HIDDEN = new Set(["path", "photo"]);

export function ContentItemForm({ item, deletable, onDelete }: { item: ContentItem; deletable: boolean; onDelete?: () => Promise<void> }) {
  const [state, action, pending] = useFormAction<Result>(saveContent.bind(null, item.id), { ok: false });
  const data = item.data as Record<string, unknown>;
  return (
    <form onSubmit={action} className={`card${item.confirmed ? "" : " unconfirmed"}`} style={{ gap: ".7rem" }}>
      <div className="row">
        <span className="muted" style={{ fontSize: ".8rem" }}>{item.key}</span>
        {!item.confirmed && <span className="badge-tbc">To confirm{item.tbc_note ? `: ${item.tbc_note}` : ""}</span>}
      </div>
      {Object.entries(data).filter(([k]) => !HIDDEN.has(k)).map(([k, v]) => {
        const name = `f_${k}`;
        const label = LABELS[k] ?? k;
        if (Array.isArray(v)) {
          const text = Array.isArray(v[0]) ? (v as string[][]).map((r) => r.join(" | ")).join("\n") : (v as string[]).join("\n");
          return <label key={k} className="field">{Array.isArray(v[0]) ? "Timetable (time | activity | detail)" : label}<textarea name={name} defaultValue={text} rows={Math.min(12, Math.max(3, (v as unknown[]).length + 1))} /></label>;
        }
        const s = String(v ?? "");
        return s.length > 70 || k === "body" || k === "a"
          ? <label key={k} className="field">{label}<textarea name={name} defaultValue={s} rows={k === "body" && s.length > 600 ? 18 : 3} /></label>
          : <label key={k} className="field">{label}<input name={name} defaultValue={s} /></label>;
      })}
      <div className="toolbar">
        <label className="chk"><input type="checkbox" name="confirmed" defaultChecked={item.confirmed} /><span>Confirmed (show publicly)</span></label>
        <label className="chk"><input type="checkbox" name="is_visible" defaultChecked={item.is_visible} /><span>Visible</span></label>
        <label className="field" style={{ minWidth: 0, width: 110 }}>Order<input name="sort_order" type="number" defaultValue={item.sort_order} /></label>
      </div>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <div className="row">
        <button className="btn small" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {deletable && onDelete && <button className="link" type="button" style={{ color: "var(--bad)" }} onClick={async () => { if (confirm("Delete this item?")) await onDelete(); }}>Delete</button>}
      </div>
    </form>
  );
}
