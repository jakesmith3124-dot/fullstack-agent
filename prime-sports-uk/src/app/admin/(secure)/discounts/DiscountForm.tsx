"use client";
import { useFormAction } from "@/lib/use-form-action";

import { saveDiscount } from "@/app/actions/admin-content";

type Result = { ok: boolean; error?: string; message?: string };
type Code = { id: string; code: string; label: string | null; kind: string; value: number; active: boolean; expires_at: string; usage_limit: number | null; times_used: number; camp_ids: string[] | null };

export function DiscountForm({ code, camps }: { code: Code | null; camps: { id: string; school: string; area: string }[] }) {
  const [state, action, pending] = useFormAction<Result>(saveDiscount.bind(null, code?.id ?? null), { ok: false });
  return (
    <form onSubmit={action} className="card" style={{ gap: ".7rem" }}>
      <div className="row"><h3>{code ? code.code : "Add a code"}</h3>{code && <span className={`tag ${code.active ? "ok" : "ph"}`}>{code.active ? "Active" : "Inactive"} · used {code.times_used}{code.usage_limit ? ` of ${code.usage_limit}` : ""}</span>}</div>
      <div className="grid2">
        <label className="field">Code<input name="code" defaultValue={code?.code} placeholder="EARLYBIRD" /></label>
        <label className="field">Label shown to parents<input name="label" defaultValue={code?.label ?? ""} placeholder="Early-bird 10%" /></label>
        <label className="field">Type<select name="kind" defaultValue={code?.kind ?? "percent"}><option value="percent">Percentage off</option><option value="fixed">Fixed amount off (£)</option></select></label>
        <label className="field">Amount (% or £)<input name="value" type="number" step="0.01" min={0} defaultValue={code ? (code.kind === "fixed" ? (code.value / 100).toFixed(2) : code.value) : ""} /></label>
        <label className="field">Expires (optional)<input name="expires_at" type="datetime-local" defaultValue={code?.expires_at ?? ""} /></label>
        <label className="field">Usage limit (optional)<input name="usage_limit" type="number" min={1} defaultValue={code?.usage_limit ?? ""} /></label>
      </div>
      <label className="field">Only for these camps (leave empty for all)
        <select name="camp_ids" multiple defaultValue={code?.camp_ids ?? []} style={{ minHeight: 100 }}>{camps.map((c) => <option key={c.id} value={c.id}>{c.school} ({c.area})</option>)}</select>
      </label>
      <label className="chk"><input type="checkbox" name="active" defaultChecked={code?.active ?? true} /><span>Active</span></label>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <button className="btn small" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Saving…" : "Save code"}</button>
    </form>
  );
}
