"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MfaClient({ next }: { next: string }) {
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrol, setEnrol] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === "verified");
      if (verified) return setFactorId(verified.id);
      // Remove half-finished enrolments before starting a fresh one.
      for (const f of data?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: e, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
      if (error || !e) return setError("We couldn't start setting up two-step sign-in. Refresh to try again.");
      setFactorId(e.id);
      setEnrol({ qr: e.totp.qr_code, secret: e.totp.secret });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) return setError("That code didn't work. Check the time on your phone and try the newest code.");
    window.location.assign(next);
  }

  return (
    <form className="card" onSubmit={verify}>
      {enrol && (
        <>
          <h2 className="h3-size">1. Scan this with your authenticator app</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrol.qr} alt="QR code for your authenticator app" width={200} height={200} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />
          <p className="hint">Can&apos;t scan it? Enter this key instead: <code data-testid="totp-secret" style={{ userSelect: "all" }}>{enrol.secret}</code></p>
          <h2 className="h3-size">2. Enter the 6-digit code</h2>
        </>
      )}
      {!enrol && factorId && <p>Enter the 6-digit code from your authenticator app.</p>}
      <label className="field">Code
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={7} placeholder="123456" />
      </label>
      <p className="err" role="alert">{error}</p>
      <button className="btn" type="submit" disabled={busy || !factorId}>{busy ? "Checking…" : "Continue"}</button>
    </form>
  );
}
