"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ? "That sign-in link has expired or was already used. Request a new one below." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Too many requests. Please wait a minute and try again." : "We couldn't send the link just now. Please try again.");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card" role="status">
        <div className="form-done">
          <span className="tick" aria-hidden="true">✓</span>
          <h2 className="h3-size">Check your email</h2>
          <p>We&apos;ve sent a sign-in link to <b>{email}</b>. Open it on this device to continue.</p>
          <button className="link" type="button" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      </div>
    );
  }
  return (
    <form className="card" onSubmit={submit} noValidate>
      <label className="field" htmlFor="email">Email address
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <p className="hint">Use the email address you booked with to see your bookings and children.</p>
      <p className="err" role="alert">{error}</p>
      <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
