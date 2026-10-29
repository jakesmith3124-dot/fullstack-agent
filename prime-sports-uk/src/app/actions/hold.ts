"use server";
import { createAdminClient } from "@/lib/supabase/server";

/** Extends a pending booking's 15-minute hold if its spaces are still free. */
export async function refreshHold(bookingId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return false;
  const { data, error } = await createAdminClient().rpc("refresh_booking_hold", { p_booking: bookingId });
  return !error && data === true;
}
