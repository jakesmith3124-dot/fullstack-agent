"use client";
import Link from "next/link";
import { startMembership } from "@/app/actions/memberships";
import { useFormAction } from "@/lib/use-form-action";

export function MembershipForm({ tiers, kids }: { tiers: { id: string; label: string }[]; kids: { id: string; first_name: string }[] }) {
  const [state, action, pending] = useFormAction<{ ok: boolean; error?: string }>(startMembership, { ok: false });
  return (
    <form onSubmit={action} style={{ display: "grid", gap: ".8rem" }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: ".4rem" }}>
        <legend style={{ fontWeight: 800, marginBottom: ".4rem" }}>Choose a plan</legend>
        {tiers.map((t, i) => <label key={t.id} className="chk"><input type="radio" name="tier_id" value={t.id} defaultChecked={i === 0} /><span>{t.label}</span></label>)}
      </fieldset>
      <label className="field">Who&apos;s joining?
        <select name="child_id">{kids.map((k) => <option key={k.id} value={k.id}>{k.first_name}</option>)}</select>
      </label>
      <label className="chk"><input type="checkbox" name="terms" /><span>I agree to the <Link href="/terms" target="_blank">membership terms</Link> and authorise a monthly payment until I cancel.</span></label>
      <p className="err" role="alert">{state.error}</p>
      <button className="btn" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Starting…" : "Start membership"}</button>
    </form>
  );
}
