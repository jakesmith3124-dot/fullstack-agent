import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/server";

/** Hashed client IP: enough for rate limiting without storing the address itself. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim();
  return createHash("sha256").update(`${ip}|${process.env.RATE_LIMIT_SALT || "psuk"}`).digest("hex").slice(0, 32);
}

/** True when the caller is under the limit. Backed by Postgres so it works across serverless instances. */
export async function rateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  const key = `${bucket}:${await clientKey()}`;
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit", error.message);
    return true; // fail open rather than block real parents if the limiter has a problem
  }
  return data === true;
}

/** Verifies a Cloudflare Turnstile token. Skipped only when no secret is configured (local dev). */
export async function verifyCaptcha(token: string | null | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") console.error("TURNSTILE_SECRET_KEY is not set in production");
    return process.env.VERCEL_ENV !== "production";
  }
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean };
  return json.success === true;
}
