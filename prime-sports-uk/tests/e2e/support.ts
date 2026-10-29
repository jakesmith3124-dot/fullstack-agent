import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

/** Reads .env.local so tests can talk to the local Supabase with the service key. */
export function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  try {
    const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : "";
  } catch {
    return "";
  }
}

export function adminDb() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

/** RFC 6238 time-based code from a base32 secret, as an authenticator app would show. */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

/** Completes the 2FA screen: enrols on first use (returns the secret) or verifies with a known secret. */
export async function passMfa(page: Page, secret?: string): Promise<string> {
  await expect(page).toHaveURL(/\/admin\/mfa/);
  if (!secret) secret = (await page.getByTestId("totp-secret").textContent({ timeout: 15_000 }))!.trim();
  // Avoid the last seconds of a 30-second window.
  if (Date.now() / 1000 % 30 > 26) await page.waitForTimeout(4500);
  await page.getByLabel("Code").fill(totp(secret));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).not.toHaveURL(/\/admin\/mfa/, { timeout: 15_000 });
  return secret;
}
