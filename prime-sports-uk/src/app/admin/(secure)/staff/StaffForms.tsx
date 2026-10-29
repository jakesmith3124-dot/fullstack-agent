"use client";
import { useActionState, useState } from "react";
import { addAssignment, addStaff } from "@/app/actions/admin-staff";

type Result = { ok: boolean; error?: string; message?: string };

export function AddStaffForm() {
  const [state, action, pending] = useActionState<Result, FormData>(addStaff, { ok: false });
  return (
    <form action={action} className="card">
      <h2>Add a staff member</h2>
      <div className="grid2">
        <label className="field">Name<input name="name" /></label>
        <label className="field">Email<input name="email" type="email" /></label>
        <label className="field">Role<select name="role" defaultValue="staff"><option value="staff">Staff (registers for their sessions only)</option><option value="owner">Owner (everything)</option></select></label>
      </div>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg">{state.message}</p>}
      <button className="btn small" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Adding…" : "Add and email them"}</button>
    </form>
  );
}

export function AssignForm({ staffId, camps }: { staffId: string; camps: { id: string; label: string; days: { id: string; label: string }[] }[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(addAssignment.bind(null, staffId), { ok: false });
  const [campId, setCampId] = useState("");
  const days = camps.find((c) => c.id === campId)?.days ?? [];
  return (
    <form action={action} className="toolbar">
      <label className="field">Camp<select name="camp_id" value={campId} onChange={(e) => setCampId(e.target.value)}><option value="">Choose…</option>{camps.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="field">Day<select name="day_id" defaultValue=""><option value="">Every day of this camp</option>{days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
      <button className="btn small" disabled={pending}>Assign</button>
      {state.error && <p className="err">{state.error}</p>}
      {state.message && <p className="okmsg">{state.message}</p>}
    </form>
  );
}
