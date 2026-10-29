"use client";
import Script from "next/script";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

/** Cloudflare Turnstile. Adds a hidden "cf-turnstile-response" field to the surrounding form. */
export function Turnstile() {
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="auto" data-size="flexible" />
    </>
  );
}
