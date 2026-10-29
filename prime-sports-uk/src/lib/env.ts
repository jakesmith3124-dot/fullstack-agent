// Central place for environment variables, so a missing value fails loudly and in one spot.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export const CONTACT_EMAIL = "admin@primesportsuk.org";
export const FACEBOOK_URL = "https://www.facebook.com/PSUK25/";
export const DARTS_URL = "https://primesportsdarts.co.uk";

export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

/**
 * Fake payments let the whole booking flow run locally without Stripe keys.
 * They can never switch on in production: they need PAYMENTS_FAKE=1, no Stripe secret key,
 * and a non-production Vercel environment.
 */
export function fakePaymentsEnabled(): boolean {
  return (
    process.env.PAYMENTS_FAKE === "1" &&
    !process.env.STRIPE_SECRET_KEY &&
    process.env.VERCEL_ENV !== "production"
  );
}
