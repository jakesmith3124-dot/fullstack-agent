import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBooking, recordPayment } from "@/lib/bookings";
import { dateRange, gbp, longDate } from "@/lib/format";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export default async function ConfirmedPage({ params }: PageProps<"/book/confirmed/[ref]">) {
  const { ref } = await params;
  if (!/^PS-[A-Z0-9]{6}$/.test(ref)) notFound();
  const db = createAdminClient();
  let booking = await loadBooking(db, { ref });
  if (!booking) notFound();

  // If the webhook hasn't arrived yet, ask Stripe directly so the parent isn't left waiting.
  if (booking.status === "pending" && stripeConfigured()) {
    const first = booking.instalments.find((i) => i.seq === 1);
    const { data: inst } = await db.from("instalments").select("stripe_payment_intent_id").eq("id", first?.id ?? "").maybeSingle();
    if (inst?.stripe_payment_intent_id) {
      const pi = await getStripe().paymentIntents.retrieve(inst.stripe_payment_intent_id, { expand: ["latest_charge"] });
      if (pi.status === "succeeded") {
        const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        await recordPayment({
          bookingId: booking.id, paymentIntentId: pi.id, amountPence: pi.amount_received, instalmentId: first?.id,
          receiptUrl: charge?.receipt_url, customerId: typeof pi.customer === "string" ? pi.customer : pi.customer?.id,
          paymentMethodId: typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id,
        });
        booking = (await loadBooking(db, { ref }))!;
      }
    }
  }

  const confirmed = booking.status === "confirmed";
  const remaining = booking.instalments.filter((i) => i.seq > 1);
  return (
    <section>
      <div className="wrap" style={{ maxWidth: 680 }}>
        {confirmed ? (
          <div className="card done">
            <div className="tick" aria-hidden="true">✓</div>
            <h1>You&apos;re booked in!</h1>
            <span className="ref">{booking.ref}</span>
            <p><b>{booking.camp.school}</b> · {dateRange(booking.days.map((d) => d.date))}</p>
            <p className="muted" style={{ maxWidth: "46ch" }}>
              We&apos;ve emailed {maskEmail(booking.parent_email)} with what to bring, drop-off times and the venue address.
              {remaining.length > 0 && ` Your remaining ${remaining.length} instalment${remaining.length > 1 ? "s" : ""} will be taken automatically: ${remaining.map((i) => `${gbp(i.amount_pence)} on ${longDate(i.due_date)}`).join(", ")}.`}
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link className="btn ghost" href="/account">See your booking</Link>
              <Link className="btn" href="/camps">Book another camp</Link>
            </div>
            <p className="hint">Sign in with your email to manage bookings, update your children&apos;s details and use the Prime Camps app.</p>
          </div>
        ) : booking.status === "pending" ? (
          <div className="card done" role="status">
            <h1>Confirming your payment…</h1>
            <p className="muted">This usually takes a few seconds. Please don&apos;t pay again.</p>
            <AutoRefresh />
          </div>
        ) : (
          <div className="card done">
            <h1>This booking wasn&apos;t completed</h1>
            <p className="muted">No payment was taken, or the booking has been cancelled. <Link href={`/camps`}>Start a new booking</Link> or contact us.</p>
          </div>
        )}
      </div>
    </section>
  );
}
