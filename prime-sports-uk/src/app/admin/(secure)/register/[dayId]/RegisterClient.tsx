"use client";
import { useFormAction } from "@/lib/use-form-action";
import { useMemo, useState, useTransition } from "react";
import { acknowledgeLate, createPost, resolvePass, signInChild, signOutChild, undoSignIn } from "@/app/actions/register";
import { fmtClock } from "@/lib/format";
import { QrScanner } from "@/components/admin/QrScanner";

export type RegisterRow = {
  id: string; name: string; age: number; group: string | null; medical: string; send: string | null; photo: boolean; collectors: string[];
  passCollector: string | null; parentName: string; parentPhone: string; emergency: string;
  signedInAt: string | null; signedOutAt: string | null; collectedBy: string | null; late: { id: string; eta: number; at: string }[];
};
type Result = { ok: boolean; error?: string; message?: string };

export function RegisterClient({ dayId, rows, groups }: { dayId: string; rows: RegisterRow[]; groups: string[] }) {
  const [filter, setFilter] = useState<"all" | "in" | "out" | "waiting">("all");
  const [group, setGroup] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [signingOut, setSigningOut] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [scanned, setScanned] = useState<{ childId: string; name: string; collector: string | null; collectors: string[] } | null>(null);
  const run = (fn: () => Promise<Result>) => start(async () => setMsg(await fn()));

  const list = rows.filter((r) => (!group || r.group === group) && (filter === "all" || (filter === "in" && r.signedInAt && !r.signedOutAt) || (filter === "out" && r.signedOutAt) || (filter === "waiting" && !r.signedInAt)));
  const lateAll = rows.flatMap((r) => r.late.map((l) => ({ ...l, name: r.name })));
  const counts = useMemo(() => ({ in: rows.filter((r) => r.signedInAt && !r.signedOutAt).length, out: rows.filter((r) => r.signedOutAt).length, waiting: rows.filter((r) => !r.signedInAt).length }), [rows]);

  return (
    <>
      {lateAll.length > 0 && (
        <div className="card unconfirmed" role="alert">
          <h2>Running late</h2>
          {lateAll.map((l) => (
            <div key={l.id} className="row">
              <span><b>{l.name}</b>: parent {l.eta >= 30 ? "30+" : l.eta} minutes late (sent {fmtClock(l.at)})</span>
              <button className="btn small" disabled={pending} onClick={() => run(() => acknowledgeLate(dayId, l.id))}>Got it</button>
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <button className="btn" onClick={() => { setScan((s) => !s); setScanned(null); }}>{scan ? "Close scanner" : "Scan pickup pass"}</button>
        <a className="btn ghost" href="#post">Post an update</a>
      </div>
      {scan && !scanned && (
        <div className="card">
          <QrScanner onCode={async (code) => {
            const r = await resolvePass(dayId, code);
            if (r.ok) setScanned(r);
            else setMsg({ ok: false, error: r.error });
          }} />
          <ManualCode onCode={async (code) => { const r = await resolvePass(dayId, code); if (r.ok) setScanned(r); else setMsg({ ok: false, error: r.error }); }} />
        </div>
      )}
      {scanned && (
        <div className="card" style={{ boxShadow: "inset 0 0 0 3px var(--ok)" }}>
          <h2>{scanned.name}</h2>
          <p>Parent says <b>{scanned.collector || "a named adult"}</b> is collecting.</p>
          <p className="muted">Authorised adults: {scanned.collectors.join(", ")}{scanned.collector && !scanned.collectors.includes(scanned.collector) ? ` · one-off today: ${scanned.collector}` : ""}</p>
          <div className="actions">
            {[...new Set([scanned.collector, ...scanned.collectors].filter(Boolean) as string[])].map((n) => (
              <button key={n} className="btn" disabled={pending} onClick={() => run(async () => { const r = await signOutChild(dayId, scanned.childId, n, "qr"); if (r.ok) { setScanned(null); setScan(false); } return r; })}>Release to {n}</button>
            ))}
            <button className="btn ghost" onClick={() => setScanned(null)}>Cancel</button>
          </div>
        </div>
      )}

      {msg?.error && <p className="err" role="alert">{msg.error}</p>}
      {msg?.message && <p className="okmsg" role="status">{msg.message}</p>}

      <div className="chips" role="group" aria-label="Filter">
        {([["all", `All ${rows.length}`], ["waiting", `Not arrived ${counts.waiting}`], ["in", `Here ${counts.in}`], ["out", `Collected ${counts.out}`]] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
        {groups.map((g) => <button key={g} className="chip" aria-pressed={group === g} onClick={() => setGroup(group === g ? "" : g)}>{g}</button>)}
      </div>

      <div style={{ display: "grid", gap: ".8rem" }}>
        {list.map((r) => (
          <div key={r.id} className="card reg-row" style={{ gap: ".5rem" }}>
            <div className="row">
              <div>
                <h2 style={{ fontSize: "1.35rem" }}>{r.name} <span className="muted" style={{ fontSize: "1rem" }}>· {r.age}{r.group ? ` · ${r.group}` : ""}</span></h2>
                <div className="chips" style={{ marginTop: ".3rem" }}>
                  {r.medical && <span className="tag med">⚕ {r.medical}</span>}
                  {r.send && <span className="tag gold">SEND: {r.send}</span>}
                  {!r.photo && <span className="tag ph">No photos</span>}
                  {r.late.length > 0 && <span className="tag med">Parent running late</span>}
                </div>
              </div>
              <span className={`tag ${r.signedOutAt ? "" : r.signedInAt ? "ok" : "ph"}`}>
                {r.signedOutAt ? `Out ${fmtClock(r.signedOutAt)}` : r.signedInAt ? `In ${fmtClock(r.signedInAt)}` : "Not arrived"}
              </span>
            </div>
            <p className="muted" style={{ fontSize: ".9rem" }}>
              Collect: <b>{r.collectors.join(", ")}</b>{r.passCollector ? ` · Today: ${r.passCollector}` : ""}<br />
              Parent: {r.parentName} <a href={`tel:${r.parentPhone.replace(/\s/g, "")}`}>{r.parentPhone}</a> · Emergency: {r.emergency}
              {r.collectedBy && <><br />Collected by <b>{r.collectedBy}</b></>}
            </p>
            <div className="actions">
              {!r.signedInAt && <button className="btn" disabled={pending} onClick={() => run(() => signInChild(dayId, r.id))}>Sign in</button>}
              {r.signedInAt && !r.signedOutAt && signingOut !== r.id && <button className="btn dark" disabled={pending} onClick={() => setSigningOut(r.id)}>Sign out</button>}
              {r.signedInAt && <button className="btn small ghost" disabled={pending} onClick={() => { if (confirm(`Undo ${r.name}'s sign-in and sign-out?`)) run(() => undoSignIn(dayId, r.id)); }}>Undo</button>}
            </div>
            {signingOut === r.id && (
              <div className="pay-box">
                <b>Who is collecting {r.name.split(" ")[0]}?</b>
                <div className="actions">
                  {[...new Set([r.passCollector, ...r.collectors].filter(Boolean) as string[])].map((n) => (
                    <button key={n} className="btn small" disabled={pending} onClick={() => run(async () => { const res = await signOutChild(dayId, r.id, n, "manual"); if (res.ok) setSigningOut(null); return res; })}>{n}</button>
                  ))}
                  <button className="btn small ghost" onClick={() => setSigningOut(null)}>Cancel</button>
                </div>
                <p className="hint">Not on the list? Don&apos;t release the child. Call the parent on {r.parentPhone}.</p>
              </div>
            )}
          </div>
        ))}
        {!list.length && <p className="muted">Nobody to show.</p>}
      </div>

      <PostForm dayId={dayId} rows={rows} groups={groups} />
    </>
  );
}

function ManualCode({ onCode }: { onCode: (c: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form className="toolbar" onSubmit={(e) => { e.preventDefault(); if (code.trim()) onCode(code.trim()); }}>
      <label className="field">Or type the pass code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PC-4821" /></label>
      <button className="btn small">Check</button>
    </form>
  );
}

function PostForm({ dayId, rows, groups }: { dayId: string; rows: RegisterRow[]; groups: string[] }) {
  const [state, action, pending] = useFormAction<Result>(createPost.bind(null, dayId), { ok: false }, (r) => r.ok);
  const [hasPhotos, setHasPhotos] = useState(false);
  return (
    <form id="post" className="card" onSubmit={action}>
      <h2>Post an update to parents</h2>
      <label className="field">Title<input name="title" placeholder="Archery is underway" /></label>
      <label className="field">Message<textarea name="body" placeholder="First arrows of the week…" /></label>
      {groups.length > 0 && <label className="field">Group<select name="group_name" defaultValue=""><option value="">Everyone</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>}
      <label className="field">Photos (optional, up to 6)<input type="file" name="photos" accept="image/*" multiple onChange={(e) => setHasPhotos(!!e.target.files?.length)} /></label>
      {hasPhotos && (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 800 }}>Who is in the photos? (only children with photo consent can be tagged)</legend>
            <div className="grid2">
              {rows.map((r) => (
                <label key={r.id} className="chk" style={{ opacity: r.photo ? 1 : 0.5 }}>
                  <input type="checkbox" name="tagged" value={r.id} disabled={!r.photo} /><span>{r.name}{!r.photo ? " (no photos)" : ""}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="chk"><input type="checkbox" name="consent_check" /><span>I&apos;ve checked: no child without photo consent appears in these photos.</span></label>
        </>
      )}
      <label className="chk"><input type="checkbox" name="notice" /><span>This is an important notice (shown at the top of Today)</span></label>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg">{state.message}</p>}
      <button className="btn" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Posting…" : "Post"}</button>
    </form>
  );
}
