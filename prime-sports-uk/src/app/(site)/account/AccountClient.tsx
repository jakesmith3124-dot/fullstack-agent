"use client";
import { useFormAction } from "@/lib/use-form-action";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { deleteMyData, membershipAction, payInstalment, saveDetails } from "@/app/actions/account";
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/env";

type Result = { ok: boolean; error?: string; message?: string };
const PREFS: [string, string][] = [
  ["sign_in", "When my child is signed in at camp"],
  ["sign_out", "When my child is signed out and collected"],
  ["updates", "New photos and updates from camp"],
  ["late_ack", "When coaches see my running-late message"],
  ["pickup_reminder", "Reminders the day before camp"],
  ["email_fallback", "Email me if the app can't send a notification"],
];

export function AccountForms({ profile }: { profile: { full_name: string; phone: string; emergency_name: string; emergency_phone: string; emergency_relationship: string; prefs: Record<string, boolean> } }) {
  const [state, action, pending] = useFormAction<Result>(saveDetails, { ok: false });
  return (
    <form className="card" onSubmit={action} id="details">
      <h2 className="h3-size">Saved details</h2>
      <div className="grid2">
        <label className="field">Full name<input name="full_name" defaultValue={profile.full_name} autoComplete="name" /></label>
        <label className="field">Mobile number<input name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" /></label>
        <label className="field">Emergency contact name<input name="emergency_name" defaultValue={profile.emergency_name} /></label>
        <label className="field">Emergency contact phone<input name="emergency_phone" type="tel" defaultValue={profile.emergency_phone} /></label>
      </div>
      <label className="field">Emergency contact&apos;s relationship to your children<input name="emergency_relationship" defaultValue={profile.emergency_relationship} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: ".5rem" }}>
        <legend style={{ fontWeight: 800, marginBottom: ".4rem" }}>Notifications from the Prime Camps app</legend>
        {PREFS.map(([k, label]) => (
          <label key={k} className="chk"><input type="checkbox" name={`pref_${k}`} defaultChecked={profile.prefs[k] !== false} /><span>{label}</span></label>
        ))}
      </fieldset>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Saving…" : "Save details"}</button>
    </form>
  );
}

export function MembershipButtons({ id, paused, cancelling }: { id: string; paused: boolean; cancelling: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const run = (a: "pause" | "resume" | "cancel" | "undo_cancel") => {
    if (a === "cancel" && !confirm("Cancel this membership? It will end at the end of the current billing period.")) return;
    start(async () => setMsg(await membershipAction(id, a)));
  };
  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      <div className="actions">
        {cancelling ? (
          <button className="btn small" disabled={pending} onClick={() => run("undo_cancel")}>Keep membership</button>
        ) : (
          <>
            <button className="btn small ghost" disabled={pending} onClick={() => run(paused ? "resume" : "pause")}>{paused ? "Resume" : "Pause"}</button>
            <button className="btn small ghost" disabled={pending} onClick={() => run("cancel")}>Cancel</button>
          </>
        )}
      </div>
      {msg?.error && <p className="err">{msg.error}</p>}
      {msg?.message && <p className="okmsg">{msg.message}</p>}
    </div>
  );
}

export function PayInstalmentButton({ id, amount }: { id: string; amount: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (secret && STRIPE_PUBLISHABLE_KEY) {
    return (
      <Elements stripe={loadStripe(STRIPE_PUBLISHABLE_KEY)} options={{ clientSecret: secret }}>
        <PayForm amount={amount} onDone={() => router.refresh()} />
      </Elements>
    );
  }
  return (
    <>
      <button className="btn small" disabled={pending} onClick={() => start(async () => {
        const r = await payInstalment(id);
        if (!r.ok) return setError(r.error);
        if (r.paid) return router.refresh();
        if (r.clientSecret) setSecret(r.clientSecret);
      })}>{pending ? "Preparing…" : `Pay ${amount} now`}</button>
      {error && <p className="err">{error}</p>}
    </>
  );
}

function PayForm({ amount, onDone }: { amount: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="pay-box">
      <PaymentElement />
      {error && <p className="err">{error}</p>}
      <button className="btn small" disabled={busy || !stripe} onClick={async () => {
        if (!stripe || !elements) return;
        setBusy(true);
        const { error } = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: `${window.location.origin}/account` } });
        setBusy(false);
        if (error) setError(error.message || "Payment failed.");
        else onDone();
      }}>{busy ? "Paying…" : `Pay ${amount}`}</button>
    </div>
  );
}

export function DeleteData() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction<Result>(deleteMyData, { ok: false });
  if (!open) return <button className="link" type="button" style={{ justifySelf: "start", color: "var(--bad)" }} onClick={() => setOpen(true)}>Delete my data</button>;
  return (
    <form onSubmit={action} style={{ display: "grid", gap: ".6rem" }}>
      <p>This permanently deletes your children&apos;s details and your contact details, and signs you out. It can&apos;t be undone.</p>
      <label className="field">Type DELETE to confirm<input name="confirm" autoComplete="off" /></label>
      <p className="err" role="alert">{state.error}</p>
      <div className="actions">
        <button className="btn" type="submit" disabled={pending} style={{ background: "var(--bad)", color: "#fff" }}>{pending ? "Deleting…" : "Delete everything"}</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
