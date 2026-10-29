"use client";
import { useActionState, useState, useTransition } from "react";
import { deleteChild, saveChild } from "@/app/actions/account";

type Child = { id: string; first_name: string; last_name: string; dob: string; school: string | null; medical: string | null; allergies: string | null; send: string | null; photo_consent: boolean; collectors: string[] } | null;
type Result = { ok: boolean; error?: string; message?: string };

export function ChildForm({ child }: { child: Child }) {
  const [state, action, pending] = useActionState<Result, FormData>(saveChild.bind(null, child?.id ?? null), { ok: false });
  const [photo, setPhoto] = useState(child ? (child.photo_consent ? "yes" : "no") : "");
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState("");
  return (
    <form className="card" action={action}>
      <div className="grid2">
        <label className="field">First name<input name="first_name" defaultValue={child?.first_name} required /></label>
        <label className="field">Surname<input name="last_name" defaultValue={child?.last_name} required /></label>
        <label className="field">Date of birth<input name="dob" type="date" defaultValue={child?.dob} required /></label>
        <label className="field">School they attend<input name="school" defaultValue={child?.school ?? ""} /></label>
      </div>
      <label className="field">Medical conditions<textarea name="medical" defaultValue={child?.medical ?? ""} placeholder="Leave blank if none" /></label>
      <div className="grid2">
        <label className="field">Allergies<input name="allergies" defaultValue={child?.allergies ?? ""} placeholder="Leave blank if none" /></label>
        <label className="field">SEND or support needs<input name="send" defaultValue={child?.send ?? ""} placeholder="Leave blank if none" /></label>
      </div>
      <label className="field">Who can collect them?<input name="collectors" defaultValue={child?.collectors.join(", ")} placeholder="Names of adults allowed to collect" /><span className="hint">Separate names with commas. We&apos;ll only release your child to these adults.</span></label>
      <input type="hidden" name="photo_consent" value={photo} />
      <div style={{ display: "grid", gap: ".4rem" }}>
        <span style={{ fontWeight: 700, fontSize: ".9rem" }} id="photo-label">Can we use photos of them on social media and in the parent app?</span>
        <div className="seg" role="group" aria-labelledby="photo-label">
          <button type="button" aria-pressed={photo === "yes"} onClick={() => setPhoto("yes")}>Yes, that&apos;s fine</button>
          <button type="button" aria-pressed={photo === "no"} onClick={() => setPhoto("no")}>No photos please</button>
        </div>
      </div>
      <p className="err" role="alert">{state.error || removeError}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <div className="row">
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {child && (
          <button type="button" className="link" style={{ color: "var(--bad)" }} disabled={removing} onClick={() => {
            if (!confirm(`Remove ${child.first_name} and all their details?`)) return;
            startRemove(async () => { const r = await deleteChild(child.id); if (r && !r.ok) setRemoveError(r.error ?? ""); });
          }}>Remove child</button>
        )}
      </div>
    </form>
  );
}
