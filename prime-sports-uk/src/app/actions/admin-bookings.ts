"use server";
import { revalidatePath } from "next/cache";
import { WaitingListOfferEmail, BookingConfirmedEmail } from "@/emails/templates";
import { assertOwner, audit } from "@/lib/auth";
import { refreshPublic, type ActionResult } from "@/lib/admin";
import { bookingEmailData, loadBooking, sendCancellationEmail } from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { gbp, longDate } from "@/lib/format";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

/** Refunds up to `amountPence`, newest payments first. Returns the amount actually refunded. */
async function refundPayments(bookingId: string, amountPence: number, reason: string, actorId: string): Promise<number> {
  const db = createAdminClient();
  const { data: payments } = await db.from("payments").select("id, stripe_payment_intent_id, amount_pence, refunded_pence").eq("booking_id", bookingId).order("created_at", { ascending: false });
  let left = amountPence;
  let done = 0;
  for (const p of payments ?? []) {
    if (left <= 0) break;
    const available = p.amount_pence - p.refunded_pence;
    if (available <= 0) continue;
    const amount = Math.min(available, left);
    let refundId: string | null = null;
    if (p.stripe_payment_intent_id?.startsWith("pi_")) {
      if (!stripeConfigured()) throw new Error("Stripe isn't configured.");
      const r = await getStripe().refunds.create(
        { payment_intent: p.stripe_payment_intent_id, amount, reason: "requested_by_customer", metadata: { booking_id: bookingId, note: reason.slice(0, 400) } },
        { idempotencyKey: `refund-${p.id}-${p.refunded_pence}-${amount}` },
      );
      refundId = r.id;
    }
    await db.from("payments").update({ refunded_pence: p.refunded_pence + amount }).eq("id", p.id);
    await db.from("refunds").insert({ booking_id: bookingId, payment_id: p.id, amount_pence: amount, reason, stripe_refund_id: refundId, created_by: actorId });
    left -= amount;
    done += amount;
  }
  if (done) {
    const { data: b } = await db.from("bookings").select("amount_refunded_pence").eq("id", bookingId).single();
    await db.from("bookings").update({ amount_refunded_pence: (b?.amount_refunded_pence ?? 0) + done }).eq("id", bookingId);
  }
  return done;
}

export async function issueRefund(bookingId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const amount = Math.round(Number(fd.get("amount")) * 100);
  const reason = String(fd.get("reason") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount to refund." };
  const db = createAdminClient();
  const booking = await loadBooking(db, { id: bookingId });
  if (!booking) return { ok: false, error: "Booking not found." };
  const refundable = booking.amount_paid_pence - booking.amount_refunded_pence;
  if (amount > refundable) return { ok: false, error: `You can refund up to ${gbp(refundable)}.` };
  try {
    const done = await refundPayments(bookingId, amount, reason, owner.id);
    await audit("refund_issued", "bookings", bookingId, { amount_pence: done, reason });
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { ok: true, message: `Refunded ${gbp(done)}.` };
  } catch (e) {
    return { ok: false, error: `Refund failed: ${(e as Error).message}` };
  }
}

export async function cancelBooking(bookingId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const refund = Math.round(Number(fd.get("refund") || 0) * 100);
  const reason = String(fd.get("reason") ?? "").trim();
  const notify = fd.get("notify") === "on";
  const db = createAdminClient();
  const booking = await loadBooking(db, { id: bookingId });
  if (!booking || booking.status === "cancelled") return { ok: false, error: "This booking can't be cancelled." };
  if (refund > booking.amount_paid_pence - booking.amount_refunded_pence) return { ok: false, error: "That refund is more than was paid." };
  let refunded = 0;
  try {
    if (refund > 0) refunded = await refundPayments(bookingId, refund, reason || "Booking cancelled", owner.id);
  } catch (e) {
    return { ok: false, error: `Refund failed, so the booking wasn't cancelled: ${(e as Error).message}` };
  }
  await db.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason || null }).eq("id", bookingId);
  await db.from("instalments").update({ status: "cancelled" }).eq("booking_id", bookingId).in("status", ["scheduled", "failed"]);
  await audit("booking_cancelled", "bookings", bookingId, { refund_pence: refunded, reason });
  if (notify) await sendCancellationEmail(booking, refunded);

  // Spaces have opened up: offer them to the first family waiting on each day.
  for (const day of booking.days) await offerNextWaiting(day.id);
  refreshPublic();
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, message: `Booking cancelled${refunded ? ` and ${gbp(refunded)} refunded` : ""}.` };
}

async function offerNextWaiting(dayId: string) {
  const db = createAdminClient();
  const { data: next } = await db.from("waiting_list").select("id").eq("camp_day_id", dayId).eq("status", "waiting").order("created_at").limit(1).maybeSingle();
  if (next) await sendOffer(next.id);
}

async function sendOffer(waitingId: string) {
  const db = createAdminClient();
  const { data: w } = await db.from("waiting_list").select("id, parent_name, parent_email, camp_days(date, camps(school, slug))").eq("id", waitingId).single();
  if (!w) return;
  const day = w.camp_days as unknown as { date: string; camps: { school: string; slug: string } };
  await sendEmail({
    to: w.parent_email,
    subject: `A space has opened up at ${day.camps.school}`,
    react: WaitingListOfferEmail({ parentName: w.parent_name, school: day.camps.school, date: longDate(day.date), slug: day.camps.slug }),
  });
  await db.from("waiting_list").update({ status: "offered", offered_at: new Date().toISOString() }).eq("id", waitingId);
}

export async function offerWaitingSpace(waitingId: string): Promise<void> {
  await assertOwner();
  await sendOffer(waitingId);
  await audit("waiting_offer_sent", "waiting_list", waitingId);
  revalidatePath("/admin/waiting-lists");
}

export async function setWaitingStatus(waitingId: string, status: "waiting" | "booked" | "removed"): Promise<void> {
  await assertOwner();
  await createAdminClient().from("waiting_list").update({ status }).eq("id", waitingId);
  revalidatePath("/admin/waiting-lists");
}

export async function resendConfirmation(bookingId: string): Promise<void> {
  await assertOwner();
  const booking = await loadBooking(createAdminClient(), { id: bookingId });
  if (!booking || booking.status !== "confirmed") return;
  await sendEmail({ to: booking.parent_email, subject: `Your booking: ${booking.camp.school} (${booking.ref})`, react: BookingConfirmedEmail(bookingEmailData(booking)) });
  await audit("confirmation_resent", "bookings", bookingId);
}

export async function clearFlag(bookingId: string, flag: "flagged_unpaid" | "over_capacity"): Promise<void> {
  await assertOwner();
  await createAdminClient().from("bookings").update({ [flag]: false }).eq("id", bookingId);
  revalidatePath(`/admin/bookings/${bookingId}`);
}
