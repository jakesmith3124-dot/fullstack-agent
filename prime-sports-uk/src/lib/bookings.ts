import "server-only";
import { BookingCancelledEmail, BookingConfirmedEmail, InstalmentReceiptEmail, PaymentFailedEmail, type BookingEmailData } from "@/emails/templates";
import { getInstalmentRules } from "./data";
import { notifyOwner, sendEmail } from "./email";
import { addDays } from "./pricing";
import { gbp, longDate, shortDay, timeRange, todayLondon } from "./format";
import { createAdminClient } from "./supabase/server";

type Db = ReturnType<typeof createAdminClient>;

export type BookingSummary = {
  id: string;
  ref: string;
  status: string;
  plan: string;
  instalment_count: number;
  total_pence: number;
  subtotal_pence: number;
  sibling_discount_pence: number;
  code_discount_pence: number;
  amount_paid_pence: number;
  amount_refunded_pence: number;
  parent_id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  discount_code_id: string | null;
  camp: { id: string; slug: string; school: string; area: string; address: string | null; postcode: string | null; start_time: string; end_time: string; what_to_bring: string | null };
  days: { id: string; date: string }[];
  children: { id: string; first_name: string; last_name: string }[];
  instalments: { id: string; seq: number; due_date: string; amount_pence: number; status: string }[];
};

export async function loadBooking(db: Db, by: { id?: string; ref?: string }): Promise<BookingSummary | null> {
  let q = db
    .from("bookings")
    .select(
      "id, ref, status, plan, instalment_count, total_pence, subtotal_pence, sibling_discount_pence, code_discount_pence, amount_paid_pence, amount_refunded_pence, parent_id, parent_name, parent_email, parent_phone, stripe_customer_id, stripe_payment_method_id, discount_code_id, camps(id, slug, school, area, address, postcode, start_time, end_time, what_to_bring), booking_places(camp_days(id, date), children(id, first_name, last_name)), instalments(id, seq, due_date, amount_pence, status)",
    );
  q = by.id ? q.eq("id", by.id) : q.eq("ref", by.ref!);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;
  const places = (data.booking_places ?? []) as unknown as { camp_days: { id: string; date: string }; children: { id: string; first_name: string; last_name: string } }[];
  const days = [...new Map(places.map((p) => [p.camp_days.id, p.camp_days])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const children = [...new Map(places.map((p) => [p.children.id, p.children])).values()];
  const { camps, booking_places: _bp, instalments, ...rest } = data as typeof data & { camps: BookingSummary["camp"] };
  void _bp;
  return {
    ...(rest as unknown as Omit<BookingSummary, "camp" | "days" | "children" | "instalments">),
    camp: camps,
    days,
    children,
    instalments: ((instalments ?? []) as BookingSummary["instalments"]).sort((a, b) => a.seq - b.seq),
  };
}

export function bookingEmailData(b: BookingSummary): BookingEmailData {
  const lines: [string, string][] = [];
  if (b.sibling_discount_pence) lines.push(["Sibling discount", `−${gbp(b.sibling_discount_pence)}`]);
  if (b.code_discount_pence) lines.push(["Discount code", `−${gbp(b.code_discount_pence)}`]);
  return {
    ref: b.ref,
    parentName: b.parent_name,
    school: b.camp.school,
    address: [b.camp.address, b.camp.area, b.camp.postcode].filter(Boolean).join(", ") || null,
    times: timeRange(b.camp.start_time, b.camp.end_time),
    days: b.days.map((d) => shortDay(d.date)),
    children: b.children.map((c) => c.first_name),
    lines,
    total: gbp(b.total_pence),
    schedule: b.instalments.length > 1 ? b.instalments.map((i) => [i.seq === 1 ? "Paid today" : longDate(i.due_date), gbp(i.amount_pence)]) : undefined,
    whatToBring: b.camp.what_to_bring,
  };
}

export type PaymentRecord = {
  bookingId: string;
  paymentIntentId: string;
  amountPence: number;
  instalmentId?: string | null;
  receiptUrl?: string | null;
  customerId?: string | null;
  paymentMethodId?: string | null;
};

/**
 * Records a successful payment and confirms the booking. Safe to call more than once for the
 * same payment (webhook retries, the confirmation page and the cron job may all call it).
 */
export async function recordPayment(p: PaymentRecord): Promise<void> {
  const db = createAdminClient();
  const { data: inserted, error } = await db
    .from("payments")
    .upsert(
      { booking_id: p.bookingId, instalment_id: p.instalmentId ?? null, stripe_payment_intent_id: p.paymentIntentId, amount_pence: p.amountPence, receipt_url: p.receiptUrl ?? null },
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`payment insert: ${error.message}`);
  if (!inserted?.length) return; // already recorded

  const booking = await loadBooking(db, { id: p.bookingId });
  if (!booking) throw new Error(`booking ${p.bookingId} not found`);

  const paid = booking.amount_paid_pence + p.amountPence;
  await db
    .from("bookings")
    .update({
      amount_paid_pence: paid,
      flagged_unpaid: paid >= booking.total_pence ? false : undefined,
      ...(p.customerId ? { stripe_customer_id: p.customerId } : {}),
      ...(p.paymentMethodId ? { stripe_payment_method_id: p.paymentMethodId } : {}),
    })
    .eq("id", booking.id);

  // Which instalment is this? Explicit id, or the first unpaid one.
  const inst = p.instalmentId
    ? booking.instalments.find((i) => i.id === p.instalmentId)
    : booking.instalments.find((i) => i.status !== "paid");
  if (inst) {
    await db.from("instalments").update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: p.paymentIntentId, last_error: null, next_retry_at: null }).eq("id", inst.id);
  }

  // First successful payment confirms the booking (exactly once).
  const { data: confirmed } = await db
    .from("bookings")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), hold_expires_at: null })
    .eq("id", booking.id)
    .neq("status", "confirmed")
    .select("id");

  if (confirmed?.length) {
    await afterConfirmed(db, booking);
  } else if (inst && inst.seq > 1) {
    const remaining = booking.instalments.filter((i) => i.status !== "paid" && i.id !== inst.id);
    await sendEmail({
      to: booking.parent_email,
      subject: `Payment received for ${booking.ref}`,
      react: InstalmentReceiptEmail({
        parentName: booking.parent_name,
        ref: booking.ref,
        amount: gbp(p.amountPence),
        seq: inst.seq,
        count: booking.instalment_count,
        remaining: remaining.length
          ? `Next payment: ${gbp(remaining[0].amount_pence)} on ${longDate(remaining[0].due_date)}.`
          : "That's your final payment. You're all paid up.",
      }),
    });
  }
}

/** Confirms a booking that needs no payment (for example, a 100% discount code). */
export async function confirmFreeBooking(bookingId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("bookings")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), hold_expires_at: null })
    .eq("id", bookingId)
    .neq("status", "confirmed")
    .select("id");
  const booking = await loadBooking(db, { id: bookingId });
  if (data?.length && booking) await afterConfirmed(db, booking);
}

async function afterConfirmed(db: Db, booking: BookingSummary) {
  if (booking.discount_code_id) {
    const { data: code } = await db.from("discount_codes").select("times_used").eq("id", booking.discount_code_id).single();
    if (code) await db.from("discount_codes").update({ times_used: code.times_used + 1 }).eq("id", booking.discount_code_id);
  }
  // Payment arrived after the hold lapsed and someone else took the space: confirm, but flag it.
  for (const day of booking.days) {
    const { data: avail } = await db.rpc("camp_availability", { p_camp: booking.camp.id });
    const d = (avail as { day_id: string; capacity: number; taken: number }[] | null)?.find((x) => x.day_id === day.id);
    if (d && d.taken > d.capacity) {
      await db.from("bookings").update({ over_capacity: true }).eq("id", booking.id);
      await notifyOwner(`Over capacity: ${booking.camp.school} on ${shortDay(day.date)}`, [["Booking", booking.ref], ["Places", `${d.taken} booked, capacity ${d.capacity}`]], `/admin/bookings/${booking.id}`);
      break;
    }
  }
  const { data: parentHas } = await db.from("profiles").select("full_name, phone").eq("id", booking.parent_id).single();
  if (parentHas && !parentHas.full_name) {
    await db.from("profiles").update({ full_name: booking.parent_name, phone: parentHas.phone || booking.parent_phone }).eq("id", booking.parent_id);
  }
  await sendEmail({
    to: booking.parent_email,
    subject: `You're booked in: ${booking.camp.school} (${booking.ref})`,
    react: BookingConfirmedEmail(bookingEmailData(booking)),
  });
}

/** Called when an off-session instalment payment fails. Schedules a retry and tells everyone. */
export async function recordInstalmentFailure(instalmentId: string, reason: string) {
  const db = createAdminClient();
  const rules = await getInstalmentRules();
  const { data: inst } = await db.from("instalments").select("id, booking_id, seq, attempts, amount_pence, status").eq("id", instalmentId).single();
  if (!inst || inst.status === "paid") return;
  const giveUp = inst.attempts >= rules.max_attempts;
  const nextRetry = giveUp ? null : new Date(Date.now() + rules.retry_days * 864e5).toISOString();
  await db.from("instalments").update({ status: "failed", last_error: reason, next_retry_at: nextRetry }).eq("id", inst.id);
  const booking = await loadBooking(db, { id: inst.booking_id });
  if (!booking) return;
  await sendEmail({
    to: booking.parent_email,
    subject: `Action needed: payment for ${booking.ref}`,
    react: PaymentFailedEmail({
      parentName: booking.parent_name,
      ref: booking.ref,
      amount: gbp(inst.amount_pence),
      reason,
      retry: giveUp
        ? "We won't try this card again automatically. Please pay from your account or contact us."
        : `We'll try again on ${longDate(nextRetry!.slice(0, 10))}.`,
    }),
  });
  await notifyOwner(`Failed instalment: ${booking.ref}`, [["Parent", `${booking.parent_name} (${booking.parent_email}, ${booking.parent_phone})`], ["Camp", booking.camp.school], ["Instalment", `${inst.seq} of ${booking.instalment_count}: ${gbp(inst.amount_pence)}`], ["Reason", reason], ["Attempt", String(inst.attempts)]], `/admin/bookings/${booking.id}`);
}

/** Flags bookings with unpaid instalments close to the camp start, for the owner to chase. */
export async function flagUnpaidBookings(): Promise<number> {
  const db = createAdminClient();
  const rules = await getInstalmentRules();
  const cutoff = addDays(todayLondon(), rules.unpaid_flag_days);
  const { data } = await db
    .from("bookings")
    .select("id, ref, parent_name, parent_phone, camps(school), booking_places(camp_days(date)), instalments(status)")
    .eq("status", "confirmed")
    .eq("plan", "instalments")
    .eq("flagged_unpaid", false);
  let flagged = 0;
  for (const b of data ?? []) {
    const dates = ((b.booking_places ?? []) as unknown as { camp_days: { date: string } }[]).map((p) => p.camp_days.date).sort();
    const unpaid = ((b.instalments ?? []) as { status: string }[]).some((i) => i.status !== "paid" && i.status !== "cancelled");
    if (unpaid && dates[0] && dates[0] <= cutoff && dates[0] >= todayLondon()) {
      await db.from("bookings").update({ flagged_unpaid: true }).eq("id", b.id);
      await notifyOwner(`Unpaid booking before camp: ${b.ref}`, [["Parent", `${b.parent_name} (${b.parent_phone})`], ["Camp", (b.camps as unknown as { school: string }).school], ["First day", longDate(dates[0])]], `/admin/bookings/${b.id}`);
      flagged++;
    }
  }
  return flagged;
}

export async function sendCancellationEmail(booking: BookingSummary, refundPence: number) {
  await sendEmail({
    to: booking.parent_email,
    subject: `Booking ${booking.ref} cancelled`,
    react: BookingCancelledEmail({ parentName: booking.parent_name, ref: booking.ref, school: booking.camp.school, refund: refundPence > 0 ? gbp(refundPence) : null }),
  });
}
