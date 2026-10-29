import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, requireServerEnv } from "@/lib/env";

/** Supabase client acting as the signed-in visitor. RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

/** Anonymous client for public, cacheable reads. RLS applies (public policies only). */
export function createPublicClient() {
  // Falls back to a dead local URL so builds without Supabase settings render empty pages instead of crashing.
  return createPlainClient(SUPABASE_URL || "http://127.0.0.1:54321", SUPABASE_ANON_KEY || "missing", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client. Bypasses RLS, so only use it on the server after your own checks:
 * webhooks, cron jobs, booking holds and lead capture.
 */
export function createAdminClient() {
  return createPlainClient(SUPABASE_URL, requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
