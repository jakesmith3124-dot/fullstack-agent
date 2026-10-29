"use client";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";
import { sendLate, setCollector } from "@/app/actions/parent-app";
import { fmtTime } from "@/lib/format";
import type { TodayData } from "@/lib/parent-app";
import { KidHero } from "../KidHero";
import { useSelectedKid, useToday } from "../useToday";

export function PickupView({ initial }: { initial: TodayData }) {
  const { data, offline } = useToday(initial);
  const [kidId, setKid] = useSelectedKid(data.children.map((c) => c.id));
  const kid = data.children.find((c) => c.id === kidId);
  const [qr, setQr] = useState("");
  const [late, setLate] = useState(10);
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<{ kid: string; name: string } | null>(null);
  const collector = picked && picked.kid === kid?.id ? picked.name : kid?.pass.collector ?? null;
  const setCollectorLocal = (name: string) => kid && setPicked({ kid: kid.id, name });

  useEffect(() => {
    if (!kid) return;
    QRCode.toDataURL(kid.pass.token, { margin: 1, width: 400, color: { dark: "#0b0b0b", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, [kid]);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  return (
    <>
      {offline && <div className="offline">You&apos;re offline. Your pickup pass still works.</div>}
      <KidHero data={data} kid={kid} onPick={setKid} />
      <main className="pa-pad">
        {kid ? (
          <section>
            <div><h2>Pickup</h2><p className="muted">Camp finishes at {fmtTime(kid.camp.endTime)} today</p></div>
            <div className="pass">
              <small>Show this at the gate</small>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="qr" src={qr} alt={`Pickup pass QR code for ${kid.firstName}`} width={220} height={220} />
              ) : <div className="qr" aria-hidden="true" />}
              <div className="code" aria-label={`Pass code ${kid.pass.code.split("").join(" ")}`}>{kid.pass.code}</div>
              <h3>{kid.firstName} {kid.lastName}{kid.group ? ` · ${kid.group}` : ""}</h3>
            </div>

            <h3>Who&apos;s collecting today?</h3>
            <div className="pick">
              {kid.collectors.map((n) => (
                <button key={n} type="button" className="opt" aria-pressed={collector === n} disabled={pending} onClick={() => start(async () => {
                  const r = await setCollector(kid.dayId, kid.id, n);
                  if (r.ok) setCollectorLocal(n);
                  say(r.message || r.error || "");
                })}>
                  <span style={{ display: "grid" }}><b>{n}</b><small>Approved adult</small></span><span className="radio" aria-hidden="true" />
                </button>
              ))}
              <button type="button" className="opt" aria-pressed={!!collector && !kid.collectors.includes(collector)} onClick={() => setShowOther((s) => !s)}>
                <span style={{ display: "grid" }}><b>{collector && !kid.collectors.includes(collector) ? collector : "Someone else"}</b><small>One-off, we&apos;ll check their name at the gate</small></span><span className="radio" aria-hidden="true" />
              </button>
              {showOther && (
                <form className="card" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setCollector(kid.dayId, kid.id, other); if (r.ok) { setCollectorLocal(other.trim()); setShowOther(false); } say(r.message || r.error || ""); }); }}>
                  <label className="field">Their full name<input value={other} onChange={(e) => setOther(e.target.value)} autoComplete="off" /></label>
                  <p className="hint">They may be asked for photo ID.</p>
                  <button className="btn" disabled={pending}>Save</button>
                </form>
              )}
            </div>

            <div className="card" style={{ display: "grid", gap: ".8rem" }}>
              <h3>Running late?</h3>
              <p className="muted">Let the coaches know so {kid.firstName} isn&apos;t left waiting.</p>
              <div className="chips" role="group" aria-label="How late">
                {[10, 20, 30].map((m) => <button key={m} type="button" className="chip" aria-pressed={late === m} onClick={() => setLate(m)}>{m === 30 ? "30+ mins" : `${m} mins`}</button>)}
              </div>
              <button className="btn dark" type="button" disabled={pending || kid.status === "out"} onClick={() => start(async () => { const r = await sendLate(kid.dayId, kid.id, late); say(r.message || r.error || ""); })}>Tell the coaches</button>
              {kid.lateSent && <p className="hint">{kid.lateSent.acknowledged ? "✓ The coaches have seen your message." : "Sent. Waiting for the coaches to see it."}</p>}
            </div>
          </section>
        ) : (
          <section><p className="muted">Pickup passes appear here on camp days.</p></section>
        )}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
