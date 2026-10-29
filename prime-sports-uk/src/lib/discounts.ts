import "server-only";
import type { DiscountCode } from "./pricing";
import { createAdminClient } from "./supabase/server";

export async function findValidCode(code: string, campId: string): Promise<(DiscountCode & { id: string }) | null> {
  if (!code.trim()) return null;
  const { data } = await createAdminClient()
    .from("discount_codes")
    .select("id, code, label, kind, value, active, expires_at, usage_limit, times_used, camp_ids")
    .ilike("code", code.trim())
    .maybeSingle();
  if (!data || !data.active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.usage_limit != null && data.times_used >= data.usage_limit) return null;
  if (data.camp_ids?.length && !data.camp_ids.includes(campId)) return null;
  return { id: data.id, code: data.code, label: data.label, kind: data.kind, value: data.value };
}
