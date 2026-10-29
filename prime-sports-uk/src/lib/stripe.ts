import "server-only";
import Stripe from "stripe";
import { requireServerEnv } from "./env";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  stripe ??= new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), { maxNetworkRetries: 2, appInfo: { name: "Prime Sports UK" } });
  return stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Finds or creates the Stripe customer for a parent and stores the id on their profile. */
export async function ensureCustomer(
  db: ReturnType<typeof import("./supabase/server").createAdminClient>,
  parent: { id: string; email: string; name: string; phone?: string },
): Promise<string> {
  const { data: profile } = await db.from("profiles").select("stripe_customer_id").eq("id", parent.id).single();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;
  const customer = await getStripe().customers.create(
    { email: parent.email, name: parent.name, phone: parent.phone, metadata: { parent_id: parent.id } },
    { idempotencyKey: `customer-${parent.id}` },
  );
  await db.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", parent.id);
  return customer.id;
}
