import Link from "next/link";
import { notFound } from "next/navigation";
import { clearFlag, resendConfirmation } from "@/app/actions/admin-bookings";
import { audit, requireOwner } from "@/lib/auth";
import { ageOn, fmtDateTime, gbp, longDate, shortDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CancelForm, RefundForm } from "./BookingAdminForms";

export default async function BookingAdmin({ params }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  await requireOwner(`/admin/bookings/${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("*, camps(school, area, slug), discount_codes(code), booking_places(camp_days(id, date), children(id, first_name, last_name, dob, medical, allergies, send, photo_consent, collectors)), instalments(id, seq, due_date, amount_pence, status, attempts, last_error, paid_at), payments(id, amount_pence, refunded_pence, created_at, receipt_url, stripe_payment_intent_id), refunds(amount_pence, reason, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  await audit("booking_viewed", "bookings", id);
  const b = data as unknown as Record<string, unknown> & {
    ref: string; status: string; plan: string; parent_name: string; parent_email: string; parent_phone: string; emergency_name: string; emergency_phone: string; emergency_relationship: string | null;
    total_pence: number; subtotal_pence: number; sibling_discount_pence: number; code_discount_pence: number; amount_paid_pence: number; amount_refunded_pence: number;
    flagged_unpaid: boolean; over_capacity: boolean; created_at: string; cancel_reason: string | null;
    camps: { school: string; area: string; slug: string }; discount_codes: { code: string } | null;
    booking_places: { camp_days: { id: string; date: string }; children: { id: string; first_name: string; last_name: string; dob: string; medical: string | null; allergies: string | null; send: string | null; photo_consent: boolean; collectors: string[] } | null }[];
    instalments: { id: string; seq: number; due_date: string; amount_pence: number; status: string; attempts: number; last_error: string | null }[];
    payments: { id: string; amount_pence: number; refunded_pence: number; created_at: string; receipt_url: string | null; stripe_payment_intent_id: string }[];
    refunds: { amount_pence: number; reason: string | null; created_at: string }[];
  };
  const days = [...new Map(b.booking_places.map((p) => [p.camp_days.id, p.camp_days.date])).values()].sort();
  const kids = [...new Map(b.booking_places.filter((p) => p.children).map((p) => [p.children!.id, p.children!])).values()];
  const refundable = b.amount_paid_pence - b.amount_refunded_pence;

  return (
    <>
      <p><Link href="/admin/bookings">← Bookings</Link></p>
      <div className="row"><h1 className="admin-title">{b.ref}</h1><span className={`tag ${b.status === "confirmed" ? "ok" : "ph"}`}>{b.status}</span></div>
      {b.flagged_unpaid && <div className="card unconfirmed"><b>An instalment is still unpaid and the camp is close.</b><form action={clearFlag.bind(null, id, "flagged_unpaid")}><button className="btn small">Mark as dealt with</button></form></div>}
      {b.over_capacity && <div className="card unconfirmed"><b>This booking took a day over capacity.</b><form action={clearFlag.bind(null, id, "over_capacity")}><button className="btn small">Mark as dealt with</button></form></div>}
      <div className="camp-detail">
        <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          <div className="card">
            <h2>{b.camps.school}</h2>
            <p>{days.map((d) => shortDay(d)).join(" · ")}</p>
            <p className="muted">Booked {fmtDateTime(b.created_at)}{b.cancel_reason ? ` · Cancelled: ${b.cancel_reason}` : ""}</p>
          </div>
          <div className="card">
            <h2>Parent</h2>
            <p><b>{b.parent_name}</b><br /><a href={`mailto:${b.parent_email}`}>{b.parent_email}</a><br /><a href={`tel:${b.parent_phone.replace(/\s/g, "")}`}>{b.parent_phone}</a></p>
            <p className="muted">Emergency: {b.emergency_name} ({b.emergency_relationship || "relationship not given"}) <a href={`tel:${b.emergency_phone.replace(/\s/g, "")}`}>{b.emergency_phone}</a></p>
          </div>
          {kids.map((k) => (
            <div className="card" key={k.id}>
              <h3>{k.first_name} {k.last_name} <span className="muted">· {ageOn(k.dob, days[0])} on the first day</span></h3>
              {(k.medical || k.allergies) ? <p><span className="tag med">{[k.medical, k.allergies].filter(Boolean).join(" · ")}</span></p> : <p className="muted">No medical or allergy information</p>}
              {k.send && <p><span className="tag gold">SEND: {k.send}</span></p>}
              <p>{k.photo_consent ? <span className="tag ok">Photos OK</span> : <span className="tag ph">No photos</span>} · Collected by: {k.collectors.join(", ")}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          <div className="card">
            <h2>Money</h2>
            <div className="line"><span>Subtotal</span><span>{gbp(b.subtotal_pence)}</span></div>
            {b.sibling_discount_pence > 0 && <div className="line disc"><span>Sibling discount</span><span>−{gbp(b.sibling_discount_pence)}</span></div>}
            {b.code_discount_pence > 0 && <div className="line disc"><span>Code {b.discount_codes?.code}</span><span>−{gbp(b.code_discount_pence)}</span></div>}
            <div className="line total"><span>Total</span><span>{gbp(b.total_pence)}</span></div>
            <div className="line"><span>Paid</span><span>{gbp(b.amount_paid_pence)}</span></div>
            {b.amount_refunded_pence > 0 && <div className="line"><span>Refunded</span><span>−{gbp(b.amount_refunded_pence)}</span></div>}
            {b.instalments.length > 1 && (
              <div className="sched">
                <b>Instalments</b>
                {[...b.instalments].sort((x, y) => x.seq - y.seq).map((i) => (
                  <div key={i.id}><span>{i.seq}. {longDate(i.due_date)}</span><span>{gbp(i.amount_pence)} · {i.status}{i.status === "failed" ? ` (${i.attempts} tries${i.last_error ? `: ${i.last_error}` : ""})` : ""}</span></div>
                ))}
              </div>
            )}
            {b.payments.length > 0 && (
              <div className="sched">
                <b>Payments</b>
                {b.payments.map((p) => <div key={p.id}><span>{fmtDateTime(p.created_at)}</span><span>{gbp(p.amount_pence)}{p.refunded_pence ? ` (refunded ${gbp(p.refunded_pence)})` : ""}{p.receipt_url && <> · <a href={p.receipt_url} target="_blank" rel="noopener">receipt</a></>}</span></div>)}
              </div>
            )}
            {b.refunds.length > 0 && <div className="sched"><b>Refunds</b>{b.refunds.map((r, i) => <div key={i}><span>{fmtDateTime(r.created_at)} {r.reason}</span><span>{gbp(r.amount_pence)}</span></div>)}</div>}
          </div>
          {refundable > 0 && <RefundForm bookingId={id} max={refundable / 100} />}
          {b.status === "confirmed" && <CancelForm bookingId={id} paid={refundable / 100} />}
          {b.status === "confirmed" && <form action={resendConfirmation.bind(null, id)}><button className="btn ghost small">Resend confirmation email</button></form>}
        </div>
      </div>
    </>
  );
}
