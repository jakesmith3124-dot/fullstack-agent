import "server-only";
import type Stripe from "stripe";
import { NoticeEmail } from "@/emails/templates";
import { notifyOwner, sendEmail } from "./email";
import { gbp, longDate } from "./format";
import { createAdminClient } from "./supabase/server";

type Db = ReturnType<typeof createAdminClient>;

function periodEnd(sub: Stripe.Subscription): string | null {
  const end = sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

/** Mirrors a Stripe subscription into our memberships table. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const db = createAdminClient();
  const meta = sub.metadata || {};
  const status = sub.status === "canceled" ? "cancelled" : sub.pause_collection ? "paused" : sub.status;
  const row = {
    status,
    paused: !!sub.pause_collection,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: periodEnd(sub),
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
  const { data: existing } = await db.from("memberships").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
  if (existing) {
    await db.from("memberships").update(row).eq("id", existing.id);
  } else if (meta.parent_id && meta.tier_id) {
    await db.from("memberships").insert({ ...row, stripe_subscription_id: sub.id, parent_id: meta.parent_id, child_id: meta.child_id || null, tier_id: meta.tier_id });
    await welcome(db, sub.id);
  }
}

async function welcome(db: Db, subscriptionId: string) {
  const m = await loadMembership(db, subscriptionId);
  if (!m) return;
  await sendEmail({
    to: m.email,
    subject: `Welcome to ${m.product}`,
    react: NoticeEmail({
      title: `Welcome to ${m.product}!`,
      lines: [`${m.child ? `${m.child} is` : "You're"} signed up to ${m.tier} (${gbp(m.price)} a month).`, "You can pause or cancel from your account before your next payment."],
      buttonLabel: "Manage membership",
      buttonHref: "/account",
    }),
  });
  await notifyOwner(`New member: ${m.product}`, [["Parent", m.email], ["Player", m.child ?? ""], ["Plan", `${m.tier}, ${gbp(m.price)}/month`]], "/admin/memberships");
}

async function loadMembership(db: Db, subscriptionId: string) {
  const { data } = await db
    .from("memberships")
    .select("id, current_period_end, profiles(email, full_name), children(first_name), membership_tiers(name, price_pence, membership_products(name))")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as {
    id: string; current_period_end: string | null;
    profiles: { email: string; full_name: string | null }; children: { first_name: string } | null;
    membership_tiers: { name: string; price_pence: number; membership_products: { name: string } };
  };
  return { id: d.id, email: d.profiles.email, name: d.profiles.full_name, child: d.children?.first_name ?? null, tier: d.membership_tiers.name, price: d.membership_tiers.price_pence, product: d.membership_tiers.membership_products.name, periodEnd: d.current_period_end };
}

function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const s = inv.parent?.subscription_details?.subscription;
  return s ? (typeof s === "string" ? s : s.id) : null;
}

export async function membershipInvoicePaid(inv: Stripe.Invoice) {
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return;
  const db = createAdminClient();
  const { data: m } = await db.from("memberships").select("id").eq("stripe_subscription_id", subId).maybeSingle();
  if (!m) return;
  await db.from("memberships").update({ last_payment_failed_at: null, status: "active" }).eq("id", m.id);
  await db.from("payments").upsert(
    { membership_id: m.id, stripe_payment_intent_id: `inv_${inv.id}`, amount_pence: inv.amount_paid, receipt_url: inv.hosted_invoice_url },
    { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
  );
}

export async function membershipInvoiceFailed(inv: Stripe.Invoice) {
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return;
  const db = createAdminClient();
  await db.from("memberships").update({ last_payment_failed_at: new Date().toISOString(), status: "past_due" }).eq("stripe_subscription_id", subId);
  const m = await loadMembership(db, subId);
  if (!m) return;
  const retry = inv.next_payment_attempt ? longDate(new Date(inv.next_payment_attempt * 1000).toISOString().slice(0, 10)) : null;
  await sendEmail({
    to: m.email,
    subject: `We couldn't take your ${m.product} payment`,
    react: NoticeEmail({
      title: "We couldn't take your payment",
      lines: [`Your monthly payment of ${gbp(inv.amount_due)} for ${m.product} didn't go through.`, retry ? `We'll try again on ${retry}.` : "Please update your card to keep your membership.", "You can update your card from your account."],
      buttonLabel: "Update card",
      buttonHref: "/account",
    }),
  });
  await notifyOwner(`Failed membership payment: ${m.product}`, [["Parent", m.email], ["Player", m.child ?? ""], ["Amount", gbp(inv.amount_due)]], "/admin/memberships");
}
