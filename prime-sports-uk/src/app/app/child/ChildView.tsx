"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { signConsentForm } from "@/app/actions/parent-app";
import { ageOn, longDate, todayLondon } from "@/lib/format";
import { useSelectedKid } from "../useToday";

type Form = { key: string; version: number; title: string; body: string; statements: string[] };
export type AppChild = {
  id: string; firstName: string; lastName: string; dob: string; hasMedical: boolean; hasSend: boolean; photoConsent: boolean;
  collectors: string[]; emergencySaved: boolean; formsToSign: Form[]; nextCamp: { school: string; date: string } | null;
};

export function ChildView({ kids }: { kids: AppChild[] }) {
  const [kidId, setKid] = useSelectedKid(kids.map((k) => k.id));
  const kid = kids.find((k) => k.id === kidId);
  const [open, setOpen] = useState<string | null>(null);
  if (!kid) {
    return <main className="pa-pad"><section><h2>Your children</h2><p className="muted">Children you book are saved here.</p><Link className="btn" href="/account/children/new">Add a child</Link></section></main>;
  }
  return (
    <main className="pa-pad">
      <section>
        {kids.length > 1 && (
          <div className="chips" role="group" aria-label="Choose a child">
            {kids.map((k) => <button key={k.id} type="button" className="chip" aria-pressed={k.id === kid.id} onClick={() => setKid(k.id)}>{k.firstName}</button>)}
          </div>
        )}
        <div className="kidhead">
          <div className="av" aria-hidden="true">{kid.firstName[0]}</div>
          <div><h2>{kid.firstName} {kid.lastName}</h2><p className="muted">Age {ageOn(kid.dob, todayLondon())}</p></div>
        </div>
        {kid.formsToSign.length ? (
          <div className="alert"><b>{kid.formsToSign.length} form{kid.formsToSign.length > 1 ? "s" : ""} need{kid.formsToSign.length > 1 ? "" : "s"} signing</b><button className="btn" style={{ minHeight: 44 }} onClick={() => setOpen(kid.formsToSign[0].key)}>Sign now</button></div>
        ) : (
          <div className="alert ok"><b>All forms signed</b><span>Ready for the next camp</span></div>
        )}
        {kid.formsToSign.filter((f) => f.key === open).map((f) => <SignForm key={f.key} childId={kid.id} form={f} onDone={() => setOpen(null)} />)}
        <div className="card">
          <h3>Saved details</h3>
          <div className="plist">
            <div><span>Medical &amp; allergies</span><span className={kid.hasMedical ? "good" : "muted"}>{kid.hasMedical ? "Saved" : "None given"}</span></div>
            <div><span>SEND or support needs</span><span className={kid.hasSend ? "good" : "muted"}>{kid.hasSend ? "Saved" : "None given"}</span></div>
            <div><span>Emergency contact</span><span className={kid.emergencySaved ? "good" : "muted"}>{kid.emergencySaved ? "Saved" : "Needed"}</span></div>
            <div><span>Photo consent</span><span className={kid.photoConsent ? "good" : "muted"}>{kid.photoConsent ? "Given" : "Not given"}</span></div>
            <div><span>Approved collectors</span><span className="muted">{kid.collectors.length} {kid.collectors.length === 1 ? "person" : "people"}</span></div>
          </div>
          <p className="muted" style={{ fontSize: ".9rem" }}>Filled in once, reused for every camp you book.</p>
          <Link className="btn ghost" href={`/account/children/${kid.id}`}>Edit details</Link>
        </div>
        {kid.nextCamp && (
          <div className="card" style={{ display: "grid", gap: ".4rem" }}>
            <span className="eyebrow">Next camp</span>
            <h3>{kid.nextCamp.school}</h3>
            <p className="muted">{longDate(kid.nextCamp.date)}</p>
            <span className="now-tag" style={{ justifySelf: "start", margin: 0 }}>Booked</span>
          </div>
        )}
        <Link className="link" href="/account#details">Notification settings</Link>
      </section>
    </main>
  );
}

function SignForm({ childId, form, onDone }: { childId: string; form: Form; onDone: () => void }) {
  const [ticked, setTicked] = useState<boolean[]>(form.statements.map(() => false));
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="card form" style={{ display: "grid", gap: ".8rem" }} onSubmit={(e) => {
      e.preventDefault();
      if (!ticked.every(Boolean)) return setError("Tick every box to give consent.");
      if (name.trim().split(/\s+/).length < 2) return setError("Type your first and last name to sign.");
      start(async () => {
        const r = await signConsentForm({ childId, formKey: form.key, version: form.version, accepted: ticked.filter(Boolean).length, name });
        if (!r.ok) return setError(r.error ?? "");
        onDone();
      });
    }}>
      <h3>{form.title}</h3>
      <p className="muted">{form.body}</p>
      {form.statements.map((s, i) => (
        <label key={i} className="chk"><input type="checkbox" checked={ticked[i]} onChange={(e) => setTicked(ticked.map((t, j) => (j === i ? e.target.checked : t)))} /><span>{s}</span></label>
      ))}
      <label className="field">Type your full name to sign<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <p className="hint">Signed today, {longDate(todayLondon())}. We keep a record of the form version you signed.</p>
      <p className="err" role="alert">{error}</p>
      <button className="btn" disabled={pending}>{pending ? "Signing…" : "Sign form"}</button>
    </form>
  );
}
