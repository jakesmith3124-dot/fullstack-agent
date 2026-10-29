"use client";
import { useActionState } from "react";
import { joinWaitingList } from "@/app/actions/waiting";
import { Turnstile } from "./Turnstile";

export function WaitingListForm({ days, defaultDay }: { days: { id: string; label: string }[]; defaultDay?: string }) {
  const [state, action, pending] = useActionState(joinWaitingList, { ok: false } as { ok: boolean; error?: string });
  if (state.ok) return <p className="okmsg" role="status">You&apos;re on the waiting list. We&apos;ll email you if a space opens up.</p>;
  return (
    <form action={action} style={{ display: "grid", gap: ".8rem" }} noValidate>
      <label className="field">Day
        <select name="day_id" defaultValue={defaultDay ?? days[0]?.id}>
          {days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <div className="form-row">
        <label className="field">Your name<input name="parent_name" autoComplete="name" required /></label>
        <label className="field">Email<input name="parent_email" type="email" autoComplete="email" required /></label>
      </div>
      <div className="form-row">
        <label className="field">Mobile (optional)<input name="parent_phone" type="tel" autoComplete="tel" /></label>
        <label className="field">Number of children
          <select name="children_count" defaultValue="1">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
        </label>
      </div>
      <Turnstile />
      <p className="err" role="alert">{state.error}</p>
      <button className="btn dark" type="submit" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Adding you…" : "Join waiting list"}</button>
    </form>
  );
}
