import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { recordInstalmentFailure, recordPayment } from "@/lib/bookings";
import { membershipInvoiceFailed, membershipInvoicePaid, syncSubscription } from "@/lib/memberships";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Stripe webhooks are the source of truth for payment state. Every event is verified by
// signature and processed at most once (stripe_events records the ids we've handled).
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: fresh } = await db.from("stripe_events").upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true }).select("id");
  if (!fresh?.length) return NextResponse.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (e) {
    // Let Stripe retry: forget that we saw this event.
    await db.from("stripe_events").delete().eq("id", event.id);
    console.error("webhook", event.type, e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      const kind = pi.metadata?.kind;
      if ((kind === "booking" || kind === "instalment") && pi.metadata.booking_id) {
        const full = await getStripe().paymentIntents.retrieve(pi.id, { expand: ["latest_charge"] });
        const charge = typeof full.latest_charge === "object" ? full.latest_charge : null;
        await recordPayment({
          bookingId: pi.metadata.booking_id,
          paymentIntentId: pi.id,
          amountPence: pi.amount_received,
          instalmentId: pi.metadata.instalment_id || null,
          receiptUrl: charge?.receipt_url,
          customerId: typeof pi.customer === "string" ? pi.customer : pi.customer?.id,
          paymentMethodId: typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id,
        });
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      if (pi.metadata?.kind === "instalment" && pi.metadata.instalment_id) {
        await recordInstalmentFailure(pi.metadata.instalment_id, (pi.last_payment_error?.message || "payment declined").replace(/\.$/, "").toLowerCase());
      }
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(await getStripe().subscriptions.retrieve(subId));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object);
      break;
    case "invoice.paid":
      await membershipInvoicePaid(event.data.object);
      break;
    case "invoice.payment_failed":
      await membershipInvoiceFailed(event.data.object);
      break;
    case "charge.refunded": {
      // Refunds made in the Stripe dashboard (ours are recorded when issued from admin).
      const charge = event.data.object;
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (piId) {
        const db = createAdminClient();
        const { data: pay } = await db.from("payments").select("id, booking_id, refunded_pence").eq("stripe_payment_intent_id", piId).maybeSingle();
        if (pay && charge.amount_refunded > pay.refunded_pence) {
          const delta = charge.amount_refunded - pay.refunded_pence;
          await db.from("payments").update({ refunded_pence: charge.amount_refunded }).eq("id", pay.id);
          if (pay.booking_id) {
            const { data: b } = await db.from("bookings").select("amount_refunded_pence").eq("id", pay.booking_id).single();
            if (b) await db.from("bookings").update({ amount_refunded_pence: b.amount_refunded_pence + delta }).eq("id", pay.booking_id);
          }
        }
      }
      break;
    }
  }
}
