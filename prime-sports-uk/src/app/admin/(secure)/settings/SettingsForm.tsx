"use client";
import { useActionState } from "react";
import { saveSettings } from "@/app/actions/admin-content";

type Result = { ok: boolean; error?: string; message?: string };
type S = Record<string, { value: unknown; confirmed: boolean }>;

export function SettingsForm({ s }: { s: S }) {
  const [state, action, pending] = useActionState<Result, FormData>(saveSettings, { ok: false });
  const inst = (s.instalments?.value ?? {}) as Record<string, number | boolean>;
  const flags = (s.flags?.value ?? {}) as Record<string, boolean>;
  const groups = (s.age_groups?.value ?? []) as { name: string; min: number; max: number }[];
  const box = (confirmed: boolean | undefined) => `card${confirmed === false ? " unconfirmed" : ""}`;
  return (
    <form action={action} style={{ display: "grid", gap: "1rem" }}>
      <div className="card">
        <h2>Feature switches</h2>
        <label className="chk"><input type="checkbox" name="flag_bookings_open" defaultChecked={flags.bookings_open} /><span>Holiday camp bookings open</span></label>
        <label className="chk"><input type="checkbox" name="flag_prime_camps_bookings" defaultChecked={flags.prime_camps_bookings} /><span>Prime Camps bookings open</span></label>
        <label className="chk"><input type="checkbox" name="flag_goat_memberships" defaultChecked={flags.goat_memberships} /><span>G.O.A.T memberships open (otherwise the page shows the waiting list)</span></label>
        <label className="chk"><input type="checkbox" name="flag_holiday_pass" defaultChecked={flags.holiday_pass} /><span>Prime Camps Holiday Pass (example product, not confirmed)</span></label>
      </div>
      <div className={box(s.sibling_discount_pct?.confirmed)}>
        <h2>Sibling discount</h2>
        <label className="field">% off each additional child in the same booking<input name="sibling_discount_pct" type="number" min={0} max={100} defaultValue={Number(s.sibling_discount_pct?.value ?? 10)} /></label>
        <label className="chk"><input type="checkbox" name="sibling_confirmed" defaultChecked={s.sibling_discount_pct?.confirmed} /><span>Confirmed. Until this is ticked, no sibling discount is applied or advertised.</span></label>
      </div>
      <div className={box(s.instalments?.confirmed)}>
        <h2>Instalments</h2>
        <label className="chk"><input type="checkbox" name="instalments_enabled" defaultChecked={inst.enabled !== false} /><span>Offer instalments</span></label>
        <div className="grid2">
          <label className="field">Final payment at least this many days before camp<input name="min_days_before" type="number" min={0} defaultValue={Number(inst.min_days_before ?? 7)} /></label>
          <label className="field">Maximum number of payments<input name="max_count" type="number" min={2} max={6} defaultValue={Number(inst.max_count ?? 3)} /></label>
          <label className="field">Days between retries after a failed payment<input name="retry_days" type="number" min={1} defaultValue={Number(inst.retry_days ?? 2)} /></label>
          <label className="field">Attempts before giving up<input name="max_attempts" type="number" min={1} defaultValue={Number(inst.max_attempts ?? 3)} /></label>
          <label className="field">Flag unpaid bookings this many days before camp<input name="unpaid_flag_days" type="number" min={0} defaultValue={Number(inst.unpaid_flag_days ?? 3)} /></label>
        </div>
        <label className="chk"><input type="checkbox" name="instalments_confirmed" defaultChecked={s.instalments?.confirmed} /><span>Confirmed</span></label>
      </div>
      <div className={box(s.age_groups?.confirmed)}>
        <h2>Prime Camps age groups</h2>
        <label className="field">One per line: name | youngest | oldest<textarea name="age_groups" rows={4} defaultValue={groups.map((g) => `${g.name} | ${g.min} | ${g.max}`).join("\n")} /></label>
        <label className="chk"><input type="checkbox" name="age_groups_confirmed" defaultChecked={s.age_groups?.confirmed} /><span>Confirmed</span></label>
      </div>
      <div className={box(s.tax_free_childcare?.confirmed)}>
        <h2>Tax-Free Childcare and vouchers</h2>
        <label className="chk"><input type="checkbox" name="tfc_accepted" defaultChecked={(s.tax_free_childcare?.value as { accepted?: boolean })?.accepted} /><span>We accept Tax-Free Childcare and childcare vouchers</span></label>
        <label className="chk"><input type="checkbox" name="tfc_confirmed" defaultChecked={s.tax_free_childcare?.confirmed} /><span>Confirmed</span></label>
      </div>
      <div className={box(s.retention_months?.confirmed)}>
        <h2>Children&apos;s data</h2>
        <label className="field">Delete medical, allergy and SEND details this many months after a child&apos;s last camp day<input name="retention_months" type="number" min={1} max={84} defaultValue={Number(s.retention_months?.value ?? 12)} /></label>
        <label className="chk"><input type="checkbox" name="retention_confirmed" defaultChecked={s.retention_months?.confirmed} /><span>Confirmed</span></label>
      </div>
      <div className="card">
        <h2>Bookings and notifications</h2>
        <div className="grid2">
          <label className="field">Hold spaces during checkout for (minutes)<input name="hold_minutes" type="number" min={5} max={60} defaultValue={Number(s.hold_minutes?.value ?? 15)} /></label>
          <label className="field">Send sign-up and alert emails to<input name="owner_notify_email" type="email" defaultValue={String(s.owner_notify_email?.value ?? "admin@primesportsuk.org")} /></label>
        </div>
      </div>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <button className="btn" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
