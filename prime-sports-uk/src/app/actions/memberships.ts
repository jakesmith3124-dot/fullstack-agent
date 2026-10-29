"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getFlags } from "@/lib/data";
import { SITE_URL, fakePaymentsEnabled } from "@/lib/env";
import { ensureCustomer, getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

/** Starts a monthly membership through Stripe Checkout (cards, Apple Pay, Google Pay). */
export async function startMembership(_prev: Result, fd: FormData): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/memberships");
  const tierId = String(fd.get("tier_id") ?? "");
  const childId = String(fd.get("child_id") ?? "");
  if (fd.get("terms") !== "on") return { ok: false, error: "Tick the box to authorise the monthly payment." };
  const supabase = await createClient();
  const { data: tier } = await supabase.from("membership_tiers").select("id, name, price_pence, confirmed, membership_products(name, flag_key)").eq("id", tierId).maybeSingle();
  const product = tier?.membership_products as unknown as { name: string; flag_key: string } | undefined;
  const flags = await getFlags();
  if (!tier || !tier.confirmed || !product || !flags[product.flag_key as keyof typeof flags]) return { ok: false, error: "That membership isn't available." };
  const { data: child } = await supabase.from("children").select("id, first_name").eq("id", childId).eq("parent_id", viewer.id).maybeSingle();
  if (!child) return { ok: false, error: "Choose who's joining." };

  const db = createAdminClient();
  if (!stripeConfigured()) {
    if (!fakePaymentsEnabled()) return { ok: false, error: "Online payments aren't set up yet." };
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    await db.from("memberships").insert({ parent_id: viewer.id, child_id: child.id, tier_id: tier.id, status: "active", current_period_end: next.toISOString(), stripe_subscription_id: `fake_sub_${crypto.randomUUID()}` });
    redirect("/account?membership=started");
  }
  const customer = await ensureCustomer(db, { id: viewer.id, email: viewer.email, name: viewer.fullName ?? viewer.email });
  const meta = { parent_id: viewer.id, child_id: child.id, tier_id: tier.id };
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: tier.price_pence, recurring: { interval: "month" }, product_data: { name: `${product.name}: ${tier.name}` } } }],
    subscription_data: { metadata: meta, description: `${product.name} for ${child.first_name}` },
    metadata: meta,
    success_url: `${SITE_URL}/account?membership=started`,
    cancel_url: `${SITE_URL}/memberships`,
    locale: "en-GB",
  });
  redirect(session.url!);
}
