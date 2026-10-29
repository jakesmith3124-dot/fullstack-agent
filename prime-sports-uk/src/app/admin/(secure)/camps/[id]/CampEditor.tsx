"use client";
import { useActionState, useState, useTransition } from "react";
import { addCampDays, deleteCamp, removeDay, saveCamp, updateDayCapacity } from "@/app/actions/admin-camps";
import { longDate } from "@/lib/format";
import type { Camp } from "@/lib/types";

type Result = { ok: boolean; error?: string; message?: string };

export function CampForm({ camp }: { camp: Camp | null }) {
  const [state, action, pending] = useActionState<Result, FormData>(saveCamp.bind(null, camp?.id ?? null), { ok: false });
  const c = camp;
  return (
    <form action={action} className={`card${c && !c.confirmed ? " unconfirmed" : ""}`} style={{ alignSelf: "start" }}>
      <h2>Camp details</h2>
      <label className="field">School or venue name<input name="school" defaultValue={c?.school} required /></label>
      <div className="grid2">
        <label className="field">Area / town<input name="area" defaultValue={c?.area} placeholder="Halifax" required /></label>
        <label className="field">Brand
          <select name="brand" defaultValue={c?.brand ?? "holiday"}><option value="holiday">Prime Sports UK holiday camp</option><option value="prime_camps">Prime Camps</option></select>
        </label>
      </div>
      <label className="field">Address<input name="address" defaultValue={c?.address ?? ""} /></label>
      <div className="grid2">
        <label className="field">Postcode<input name="postcode" defaultValue={c?.postcode ?? ""} /></label>
        <label className="field">Order (lower shows first)<input name="sort_order" type="number" defaultValue={c?.sort_order ?? 10} /></label>
      </div>
      {!c && <label className="field">Web address (optional)<input name="slug" placeholder="e.g. bowling-green-february-2027" /><span className="hint">Leave blank to make one from the school name.</span></label>}
      <label className="field">Short description<textarea name="description" defaultValue={c?.description ?? ""} /></label>
      <div className="grid2">
        <label className="field">Youngest age<input name="age_min" type="number" min={2} max={18} defaultValue={c?.age_min ?? 4} /></label>
        <label className="field">Oldest age<input name="age_max" type="number" min={2} max={18} defaultValue={c?.age_max ?? 11} /></label>
        <label className="field">Start time<input name="start_time" type="time" defaultValue={c?.start_time?.slice(0, 5) ?? "09:00"} /></label>
        <label className="field">Finish time<input name="end_time" type="time" defaultValue={c?.end_time?.slice(0, 5) ?? "15:00"} /></label>
        <label className="field">Price per day (£)<input name="price_per_day" type="number" step="0.01" min={0} defaultValue={c ? (c.price_per_day_pence / 100).toFixed(2) : ""} required /></label>
        <label className="field">Full-week price (£, optional)<input name="full_week_price" type="number" step="0.01" min={0} defaultValue={c?.full_week_price_pence ? (c.full_week_price_pence / 100).toFixed(2) : ""} /></label>
        <label className="field">Bookings open (optional)<input name="booking_opens_at" type="datetime-local" defaultValue={c?.booking_opens_at ?? ""} /></label>
        <label className="field">Bookings close (optional)<input name="booking_closes_at" type="datetime-local" defaultValue={c?.booking_closes_at ?? ""} /></label>
      </div>
      <label className="field">What to bring<textarea name="what_to_bring" defaultValue={c?.what_to_bring ?? ""} /></label>
      <label className="field">Day timetable (one line each: time | activity | detail)
        <textarea name="timetable" rows={6} defaultValue={(c?.timetable ?? []).map((t) => t.join(" | ")).join("\n")} placeholder={"8:30 | Drop-off and free play | Signed in by name\n12:00 | Lunch | Packed lunch, supervised"} />
        <span className="hint">Shown to parents in the Prime Camps app.</span>
      </label>
      <label className="chk"><input type="checkbox" name="is_visible" defaultChecked={c?.is_visible ?? true} /><span>Visible on the website</span></label>
      <label className="chk"><input type="checkbox" name="confirmed" defaultChecked={c?.confirmed ?? false} /><span>Venue, dates and prices are confirmed (camps only appear publicly once confirmed)</span></label>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Saving…" : c ? "Save changes" : "Create camp"}</button>
    </form>
  );
}

export function DaysEditor({ campId, days }: { campId: string; days: { id: string; date: string; capacity: number; taken: number }[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(addCampDays.bind(null, campId), { ok: false });
  const [msg, setMsg] = useState<Result | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="card">
      <h2>Days and places</h2>
      {days.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Booked</th><th>Places</th><th></th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.id}>
                  <td>{longDate(d.date)}</td>
                  <td>{d.taken}</td>
                  <td>
                    <input className="input" type="number" min={0} defaultValue={d.capacity} style={{ width: 90 }} aria-label={`Places on ${longDate(d.date)}`}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== d.capacity) start(async () => setMsg(await updateDayCapacity(d.id, v))); }} />
                  </td>
                  <td><button className="link" disabled={busy} onClick={() => start(async () => setMsg(await removeDay(d.id)))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">No days yet.</p>}
      {msg?.error && <p className="err">{msg.error}</p>}
      {msg?.message && <p className="okmsg">{msg.message}</p>}
      <form action={action} style={{ display: "grid", gap: ".6rem" }}>
        <h3>Add days</h3>
        <div className="grid2">
          <label className="field">From<input name="from" type="date" required /></label>
          <label className="field">To (optional)<input name="to" type="date" /></label>
          <label className="field">Places per day<input name="capacity" type="number" min={0} defaultValue={30} /></label>
        </div>
        <label className="chk"><input type="checkbox" name="weekdays_only" defaultChecked /><span>Weekdays only</span></label>
        <p className="err" role="alert">{state.error}</p>
        {state.message && <p className="okmsg" role="status">{state.message}</p>}
        <button className="btn small" type="submit" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Adding…" : "Add days"}</button>
      </form>
    </div>
  );
}

export function DeleteCampButton({ campId }: { campId: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button className="link" style={{ color: "var(--bad)" }} disabled={busy} onClick={() => {
        if (!confirm("Delete this camp? This can't be undone.")) return;
        start(async () => { const r = await deleteCamp(campId); if (r && !r.ok) setError(r.error ?? ""); });
      }}>Delete camp</button>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
