"use client";
import { useActionState } from "react";
import { cancelBooking, issueRefund } from "@/app/actions/admin-bookings";

type Result = { ok: boolean; error?: string; message?: string };

export function RefundForm({ bookingId, max }: { bookingId: string; max: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(issueRefund.bind(null, bookingId), { ok: false });
  return (
    <form className="card" action={action} onSubmit={(e) => { if (!confirm("Issue this refund through Stripe?")) e.preventDefault(); }}>
      <h2>Refund</h2>
      <div className="grid2">
        <label className="field">Amount (£)<input name="amount" type="number" step="0.01" min="0.01" max={max} defaultValue={max.toFixed(2)} /></label>
        <label className="field">Reason<input name="reason" placeholder="e.g. Child unwell on Tuesday" /></label>
      </div>
      <p className="hint">Full or partial. Refunds go back to the card used and take 5 to 10 working days.</p>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg">{state.message}</p>}
      <button className="btn small" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Refunding…" : "Issue refund"}</button>
    </form>
  );
}

export function CancelForm({ bookingId, paid }: { bookingId: string; paid: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(cancelBooking.bind(null, bookingId), { ok: false });
  return (
    <form className="card" action={action} onSubmit={(e) => { if (!confirm("Cancel this booking? Its places will be released.")) e.preventDefault(); }}>
      <h2>Cancel booking</h2>
      <div className="grid2">
        <label className="field">Refund (£)<input name="refund" type="number" step="0.01" min="0" max={paid} defaultValue={paid.toFixed(2)} /></label>
        <label className="field">Reason<input name="reason" /></label>
      </div>
      <label className="chk"><input type="checkbox" name="notify" defaultChecked /><span>Email the parent a cancellation confirmation</span></label>
      <p className="hint">Future instalments are cancelled, and the first family on each day&apos;s waiting list is emailed.</p>
      <p className="err" role="alert">{state.error}</p>
      {state.message && <p className="okmsg">{state.message}</p>}
      <button className="btn small" disabled={pending} style={{ justifySelf: "start", background: "var(--bad)", color: "#fff" }}>{pending ? "Cancelling…" : "Cancel booking"}</button>
    </form>
  );
}
