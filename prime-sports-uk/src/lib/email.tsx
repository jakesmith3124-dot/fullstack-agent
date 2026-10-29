import "server-only";
import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { OwnerNotificationEmail } from "@/emails/templates";
import { getSettings } from "./data";

const FROM = process.env.EMAIL_FROM || "Prime Sports UK <bookings@primesportsuk.org>";
let client: Resend | null = null;

/** Sends an email through Resend. Without an API key (local dev) it logs instead. Never throws. */
export async function sendEmail(opts: { to: string | string[]; subject: string; react: ReactElement; replyTo?: string }) {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      const text = await render(opts.react, { plainText: true });
      console.info(`[email] to=${opts.to} subject="${opts.subject}"\n${text.slice(0, 600)}`);
      return { ok: true, dev: true };
    }
    client ??= new Resend(key);
    const { error } = await client.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      react: opts.react,
      replyTo: opts.replyTo || "admin@primesportsuk.org",
    });
    if (error) {
      console.error("email failed", opts.subject, error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("email error", opts.subject, e);
    return { ok: false };
  }
}

export async function ownerEmail(): Promise<string> {
  const s = await getSettings();
  return (s.owner_notify_email?.value as string) || "admin@primesportsuk.org";
}

export async function notifyOwner(title: string, rows: [string, string][], link?: string) {
  return sendEmail({ to: await ownerEmail(), subject: title, react: <OwnerNotificationEmail title={title} rows={rows} link={link} /> });
}
