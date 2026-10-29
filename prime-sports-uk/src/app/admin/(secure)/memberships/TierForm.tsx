"use client";
import { useActionState } from "react";
import { saveTier } from "@/app/actions/admin-content";

type Result = { ok: boolean; error?: string; message?: string };

export function TierForm({ tier }: { tier: { id: string; name: string; price_pence: number; confirmed: boolean } }) {
  const [state, action, pending] = useActionState<Result, FormData>(saveTier.bind(null, tier.id), { ok: false });
  return (
    <form action={action} className={`toolbar${tier.confirmed ? "" : " unconfirmed"}`} style={{ padding: ".6rem", borderRadius: 14 }}>
      <label className="field">Tier<input name="name" defaultValue={tier.name} /></label>
      <label className="field">£ per month<input name="price" type="number" step="0.01" defaultValue={(tier.price_pence / 100).toFixed(2)} /></label>
      <label className="chk"><input type="checkbox" name="confirmed" defaultChecked={tier.confirmed} /><span>Price confirmed</span></label>
      <button className="btn small" disabled={pending}>Save</button>
      {state.error && <span className="err">{state.error}</span>}
      {state.message && <span className="okmsg">{state.message}</span>}
    </form>
  );
}
