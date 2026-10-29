"use server";
import { getViewer } from "@/lib/auth";
import { confirmFreeBooking, recordPayment } from "@/lib/bookings";
import { getCampBySlug, getFlags, getInstalmentRules, getSiblingDiscount, isBookable } from "@/lib/data";
import { findValidCode } from "@/lib/discounts";
import { fakePaymentsEnabled } from "@/lib/env";
import { ageOn, todayLondon } from "@/lib/format";
import { instalmentOptions, instalmentSchedule, quote } from "@/lib/pricing";
import { rateLimit } from "@/lib/security";
import { ensureCustomer, getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { bookingSchema, firstError, splitCollectors, type BookingInput } from "@/lib/validation";

export async function checkDiscountCode(campSlug: string, code: string) {
  if (!(await rateLimit("code", 20, 600))) return { ok: false as const, error: "Too many attempts. Please wait a few minutes." };
  const camp = await getCampBySlug(campSlug);
  if (!camp) return { ok: false as const, error: "That camp isn't available." };
  const found = await findValidCode(code, camp.id);
  if (!found) return { ok: false as const, error: "That code isn't valid. Check the spelling and try again." };
  return { ok: true as const, code: { code: found.code, label: found.label, kind: found.kind, value: found.value } };
}

export type StartResult =
  | { ok: true; bookingId: string; ref: string; mode: "stripe" | "fake" | "free"; clientSecret?: string; dueNowPence: number }
  | { ok: false; error: string };

/**
 * Validates everything again on the server, holds the spaces for 15 minutes and prepares payment.
 * Prices are always recalculated here from the database; nothing the browser sends is trusted.
 */
export async function startBooking(raw: BookingInput): Promise<StartResult> {
  if (!(await rateLimit("booking", 15, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  const [camp, flags, sibling, rules, viewer] = await Promise.all([
    getCampBySlug(input.camp_slug), getFlags(), getSiblingDiscount(), getInstalmentRules(), getViewer(),
  ]);
  if (!camp || !isBookable(camp, flags)) return { ok: false, error: "Bookings for this camp aren't open." };

  const today = todayLondon();
  const chosen = camp.days.filter((d) => input.day_ids.includes(d.day_id));
  if (chosen.length !== input.day_ids.length || chosen.some((d) => d.date < today)) {
    return { ok: false, error: "One of the days you picked isn't available any more. Please choose again." };
  }
  const firstDay = chosen.map((d) => d.date).sort()[0];
  for (const [i, c] of input.children.entries()) {
    const age = ageOn(c.dob, firstDay);
    if (age < camp.age_min || age > camp.age_max) {
      return { ok: false, error: `${c.first_name || `Child ${i + 1}`} will be ${age} on the first day. This camp is for ages ${camp.age_min}–${camp.age_max}.` };
    }
  }

  const code = input.code ? await findValidCode(input.code, camp.id) : null;
  if (input.code && !code) return { ok: false, error: "That discount code isn't valid any more." };
  const q = quote({
    pricePerDayPence: camp.price_per_day_pence,
    fullWeekPricePence: camp.full_week_price_pence,
    campDayCount: camp.days.length,
    selectedDayCount: chosen.length,
    childCount: input.children.length,
    siblingPct: sibling.confirmed ? sibling.pct : 0,
    code,
  });

  let instalmentCount = 1;
  if (input.plan !== "full") {
    if (!instalmentOptions(today, firstDay, rules).includes(input.plan)) {
      return { ok: false, error: "Instalments aren't available for these dates. Please choose to pay in full." };
    }
    instalmentCount = input.plan;
  }
  const schedule = instalmentSchedule(q.totalPence, instalmentCount, today);
  const dueNow = schedule[0].amountPence;

  const db = createAdminClient();
  const email = input.parent.email.toLowerCase();

  // Who is the parent? The signed-in account, or the account for this email (created if new).
  let parentId: string;
  if (viewer) {
    parentId = viewer.id;
    await db.from("profiles").update({
      full_name: input.parent.name,
      phone: input.parent.phone,
      emergency_name: input.parent.emergency_name,
      emergency_phone: input.parent.emergency_phone,
      emergency_relationship: input.parent.emergency_relationship,
    }).eq("id", viewer.id);
  } else {
    const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) {
      parentId = existing.id;
    } else {
      const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (error || !created.user) return { ok: false, error: "We couldn't set up your booking just now. Please try again." };
      parentId = created.user.id;
      await db.from("profiles").upsert({
        id: parentId, email, full_name: input.parent.name, phone: input.parent.phone,
        emergency_name: input.parent.emergency_name, emergency_phone: input.parent.emergency_phone,
        emergency_relationship: input.parent.emergency_relationship,
      });
    }
  }

  // Children: update saved ones (signed-in parents only), add new ones.
  const childIds: string[] = [];
  for (const c of input.children) {
    const row = {
      first_name: c.first_name, last_name: c.last_name, dob: c.dob, school: c.school || null,
      medical: c.medical || null, allergies: c.allergies || null, send: c.send || null,
      photo_consent: c.photo_consent === "yes", collectors: splitCollectors(c.collectors),
    };
    if (c.id && viewer) {
      const { data } = await db.from("children").update(row).eq("id", c.id).eq("parent_id", parentId).select("id");
      if (data?.length) { childIds.push(c.id); continue; }
    }
    const { data, error } = await db.from("children").insert({ ...row, parent_id: parentId }).select("id").single();
    if (error || !data) return { ok: false, error: "We couldn't save your children's details. Please try again." };
    childIds.push(data.id);
  }

  // Hold the spaces. Capacity is checked inside one database transaction with row locks.
  const { data: hold, error: holdError } = await db.rpc("create_booking_hold", {
    p: {
      camp_id: camp.id, parent_id: parentId, day_ids: input.day_ids, child_ids: childIds,
      lines: childIds.map((id) => ({ child_id: id, line_total_pence: q.perChildPence })),
      plan: instalmentCount > 1 ? "instalments" : "full", instalment_count: instalmentCount,
      subtotal_pence: q.subtotalPence, sibling_discount_pence: q.siblingDiscountPence,
      code_discount_pence: q.codeDiscountPence, total_pence: q.totalPence, discount_code_id: code?.id ?? "",
      parent_name: input.parent.name, parent_email: email, parent_phone: input.parent.phone,
      emergency_name: input.parent.emergency_name, emergency_phone: input.parent.emergency_phone,
      emergency_relationship: input.parent.emergency_relationship,
    },
  });
  if (holdError || !hold?.[0]) {
    const full = holdError?.message.match(/DAY_FULL:(\S+)/);
    return { ok: false, error: full ? `Sorry, ${new Date(full[1]).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} has just filled up. Please choose different days or join the waiting list.` : "We couldn't hold your spaces just now. Please try again." };
  }
  const { booking_id: bookingId, ref } = hold[0] as { booking_id: string; ref: string };

  const { data: instRows } = await db.from("instalments").insert(
    schedule.map((s) => ({ booking_id: bookingId, seq: s.seq, due_date: s.dueDate, amount_pence: s.amountPence, status: s.seq === 1 ? "processing" : "scheduled" })),
  ).select("id, seq");
  const firstInstalmentId = instRows?.find((r) => r.seq === 1)?.id;

  if (q.totalPence === 0) {
    await db.from("instalments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("booking_id", bookingId);
    await confirmFreeBooking(bookingId);
    return { ok: true, bookingId, ref, mode: "free", dueNowPence: 0 };
  }

  if (!stripeConfigured()) {
    if (fakePaymentsEnabled()) return { ok: true, bookingId, ref, mode: "fake", dueNowPence: dueNow };
    return { ok: false, error: "Online payments aren't set up yet. Please contact us to book." };
  }

  const customerId = await ensureCustomer(db, { id: parentId, email, name: input.parent.name, phone: input.parent.phone });
  const pi = await getStripe().paymentIntents.create(
    {
      amount: dueNow,
      currency: "gbp",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      ...(instalmentCount > 1 ? { setup_future_usage: "off_session" as const } : {}),
      description: `${camp.school} holiday camp (${ref})${instalmentCount > 1 ? `, instalment 1 of ${instalmentCount}` : ""}`,
      receipt_email: email,
      metadata: { kind: "booking", booking_id: bookingId, ref, instalment_id: firstInstalmentId ?? "" },
    },
    { idempotencyKey: `booking-${bookingId}-1` },
  );
  await db.from("bookings").update({ stripe_customer_id: customerId }).eq("id", bookingId);
  await db.from("instalments").update({ stripe_payment_intent_id: pi.id }).eq("id", firstInstalmentId!);
  return { ok: true, bookingId, ref, mode: "stripe", clientSecret: pi.client_secret!, dueNowPence: dueNow };
}

/** Local development only: pretends the card payment succeeded (or was declined). */
export async function fakePay(bookingId: string, decline: boolean) {
  if (!fakePaymentsEnabled()) return { ok: false as const, error: "Not available." };
  if (decline) return { ok: false as const, error: "Your card was declined. Try a different card." };
  const db = createAdminClient();
  const { data: inst } = await db.from("instalments").select("id, amount_pence").eq("booking_id", bookingId).eq("seq", 1).single();
  if (!inst) return { ok: false as const, error: "Booking not found." };
  await recordPayment({ bookingId, paymentIntentId: `fake_pi_${bookingId}_1`, amountPence: inst.amount_pence, instalmentId: inst.id, paymentMethodId: "fake_pm", customerId: "fake_cus" });
  return { ok: true as const };
}
