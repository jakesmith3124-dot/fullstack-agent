import "server-only";
import webpush from "web-push";
import { NoticeEmail } from "@/emails/templates";
import { sendEmail } from "./email";
import { createAdminClient } from "./supabase/server";

export type NotificationKind = "sign_in" | "sign_out" | "updates" | "late_ack" | "pickup_reminder";
type Payload = { title: string; body: string; url?: string; tag?: string };

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@primesportsuk.org", pub!, priv!);
  return configured;
}

/**
 * Sends a web push notification to every device a parent has registered, if they've opted in
 * to this kind of notification. Falls back to email when no device accepts it (and they allow that).
 */
export async function notifyParent(userId: string, kind: NotificationKind, payload: Payload, opts: { emailFallback?: boolean } = {}) {
  try {
    const db = createAdminClient();
    const { data: profile } = await db.from("profiles").select("email, notification_prefs").eq("id", userId).single();
    if (!profile) return;
    const prefs = (profile.notification_prefs ?? {}) as Record<string, boolean>;
    if (prefs[kind] === false) return;

    let delivered = 0;
    if (ready()) {
      const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...payload, tag: payload.tag || kind }), { TTL: 3600 });
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
    if (!delivered && opts.emailFallback !== false && prefs.email_fallback !== false && profile.email) {
      await sendEmail({ to: profile.email, subject: payload.title, react: NoticeEmail({ title: payload.title, lines: [payload.body], buttonLabel: "Open the app", buttonHref: payload.url || "/app" }) });
    }
  } catch (e) {
    console.error("notifyParent", e);
  }
}

/** Push to the staff assigned to a camp day (and the owner), for running-late alerts. */
export async function notifyStaffForDay(dayId: string, payload: Payload) {
  try {
    const db = createAdminClient();
    const { data: day } = await db.from("camp_days").select("camp_id").eq("id", dayId).single();
    if (!day) return;
    const { data: staff } = await db.from("staff_assignments").select("staff_id, camp_day_id").eq("camp_id", day.camp_id);
    const { data: owners } = await db.from("profiles").select("id").eq("role", "owner");
    const ids = new Set([...(staff ?? []).filter((s) => !s.camp_day_id || s.camp_day_id === dayId).map((s) => s.staff_id), ...(owners ?? []).map((o) => o.id)]);
    if (!ready()) return;
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", [...ids]);
    for (const s of subs ?? []) {
      await webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...payload, tag: payload.tag || "late" }), { TTL: 1800 })
        .catch(async (e: { statusCode?: number }) => { if (e.statusCode === 404 || e.statusCode === 410) await db.from("push_subscriptions").delete().eq("id", s.id); });
    }
  } catch (e) {
    console.error("notifyStaffForDay", e);
  }
}
