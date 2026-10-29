import { NextResponse } from "next/server";
import { flagUnpaidBookings } from "@/lib/bookings";
import { cronAuthorised } from "@/lib/cron";
import { chargeDueInstalments } from "@/lib/instalments";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Runs every morning: expire stale holds, take due instalments, flag unpaid bookings, apply data retention.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = createAdminClient();
  const { data: expired } = await db
    .from("bookings")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("hold_expires_at", new Date().toISOString())
    .select("id");
  const instalments = await chargeDueInstalments();
  const flagged = await flagUnpaidBookings();
  const { data: anonymised } = await db.rpc("apply_medical_retention");
  await db.from("rate_limits").delete().lt("window_start", new Date(Date.now() - 864e5).toISOString());
  const result = { expired: expired?.length ?? 0, ...instalments, flagged, anonymised };
  console.info("cron daily", result);
  return NextResponse.json(result);
}
