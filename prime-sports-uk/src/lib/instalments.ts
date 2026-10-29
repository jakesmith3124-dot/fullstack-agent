import "server-only";
import { recordInstalmentFailure, recordPayment } from "./bookings";
import { fakePaymentsEnabled } from "./env";
import { todayLondon } from "./format";
import { getStripe, stripeConfigured } from "./stripe";
import { createAdminClient } from "./supabase/server";

type DueRow = {
  id: string; booking_id: string; seq: number; amount_pence: number; attempts: number; status: string;
  bookings: { ref: string; status: string; stripe_customer_id: string | null; stripe_payment_method_id: string | null; instalment_count: number; camps: { school: string } };
};

/** Takes every scheduled instalment that is due today (and retries failed ones whose retry time has come). */
export async function chargeDueInstalments(): Promise<{ charged: number; failed: number }> {
  const db = createAdminClient();
  const today = todayLondon();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("instalments")
    .select("id, booking_id, seq, amount_pence, attempts, status, bookings!inner(ref, status, stripe_customer_id, stripe_payment_method_id, instalment_count, camps(school))")
    .lte("due_date", today)
    .or(`status.eq.scheduled,and(status.eq.failed,next_retry_at.lte.${now})`)
    .eq("bookings.status", "confirmed")
    .limit(200);
  if (error) throw new Error(error.message);
  let charged = 0;
  let failed = 0;
  for (const row of (data ?? []) as unknown as DueRow[]) {
    // Claim the row so overlapping runs can't charge twice.
    const { data: claimed } = await db
      .from("instalments")
      .update({ status: "processing", attempts: row.attempts + 1 })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id");
    if (!claimed?.length) continue;
    const ok = await chargeOne(row, row.attempts + 1);
    if (ok) charged++;
    else failed++;
  }
  return { charged, failed };
}

async function chargeOne(row: DueRow, attempt: number): Promise<boolean> {
  const b = row.bookings;
  if (!stripeConfigured()) {
    if (!fakePaymentsEnabled()) return false;
    await recordPayment({ bookingId: row.booking_id, paymentIntentId: `fake_pi_${row.id}_${attempt}`, amountPence: row.amount_pence, instalmentId: row.id });
    return true;
  }
  if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
    await recordInstalmentFailure(row.id, "no saved card");
    return false;
  }
  try {
    const pi = await getStripe().paymentIntents.create(
      {
        amount: row.amount_pence,
        currency: "gbp",
        customer: b.stripe_customer_id,
        payment_method: b.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `${b.camps.school} holiday camp (${b.ref}), instalment ${row.seq} of ${b.instalment_count}`,
        metadata: { kind: "instalment", booking_id: row.booking_id, ref: b.ref, instalment_id: row.id },
      },
      { idempotencyKey: `instalment-${row.id}-attempt-${attempt}` },
    );
    if (pi.status === "succeeded") {
      await recordPayment({ bookingId: row.booking_id, paymentIntentId: pi.id, amountPence: pi.amount_received, instalmentId: row.id });
      return true;
    }
    // Needs authentication (3-D Secure) or still processing: the webhook finishes the job.
    if (pi.status === "requires_action" || pi.status === "requires_payment_method") {
      await recordInstalmentFailure(row.id, "your bank asked for extra confirmation");
      return false;
    }
    return true;
  } catch (e) {
    const message = (e as { message?: string }).message || "payment declined";
    await recordInstalmentFailure(row.id, message.replace(/\.$/, "").toLowerCase());
    return false;
  }
}
