// Transactional email templates (React Email). Plain, mobile-friendly, black and gold.
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const gold = "#d4a72c";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

function Layout({ preview, title, children }: { preview: string; title: string; children: ReactNode }) {
  return (
    <Html lang="en-GB">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: "#f7f5f0", fontFamily: "Helvetica, Arial, sans-serif", color: "#111", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
          <Section style={{ background: "#0b0b0b", borderRadius: "16px 16px 0 0", padding: "18px 24px" }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>
              Prime <span style={{ color: gold }}>Sports</span> UK
            </Text>
          </Section>
          <Section style={{ background: "#fff", borderRadius: "0 0 16px 16px", padding: "24px" }}>
            <Heading as="h1" style={{ fontSize: 24, margin: "0 0 12px", textTransform: "uppercase" }}>{title}</Heading>
            {children}
            <Hr style={{ borderColor: "#e6e0d3", margin: "24px 0 12px" }} />
            <Text style={{ fontSize: 12, color: "#5c574d", margin: 0 }}>
              Prime Sports UK · admin@primesportsuk.org · Hard Work Beats Talent
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const p = { fontSize: 15, lineHeight: "22px", margin: "0 0 12px" } as const;
const row = { fontSize: 14, margin: "0 0 4px" } as const;
const cta = { background: gold, color: "#0b0b0b", borderRadius: 999, padding: "12px 22px", fontWeight: 800, textDecoration: "none" } as const;

export type BookingEmailData = {
  ref: string;
  parentName: string;
  school: string;
  address: string | null;
  times: string;
  days: string[];
  children: string[];
  lines: [string, string][];
  total: string;
  schedule?: [string, string][];
  whatToBring?: string | null;
};

export function BookingConfirmedEmail(d: BookingEmailData) {
  return (
    <Layout preview={`You're booked in: ${d.school} (${d.ref})`} title="You're booked in!">
      <Text style={p}>Hi {d.parentName.split(" ")[0]}, thanks for booking with Prime Sports UK. Your reference is <b>{d.ref}</b>.</Text>
      <Text style={row}><b>{d.school}</b>{d.address ? `, ${d.address}` : ""}</Text>
      <Text style={row}>{d.times}</Text>
      <Text style={row}>{d.days.join(" · ")}</Text>
      <Text style={{ ...row, marginBottom: 12 }}>Coming: {d.children.join(", ")}</Text>
      {d.lines.map(([a, b]) => <Text key={a} style={row}>{a}: {b}</Text>)}
      <Text style={{ ...p, fontWeight: 800 }}>Total: {d.total}</Text>
      {d.schedule && d.schedule.length > 1 && (
        <>
          <Text style={{ ...p, fontWeight: 800, marginTop: 12 }}>Your payment schedule</Text>
          {d.schedule.map(([a, b]) => <Text key={a} style={row}>{a}: {b}</Text>)}
          <Text style={p}>Payments are taken automatically from the same card. All instalments finish before the camp starts.</Text>
        </>
      )}
      {d.whatToBring && <Text style={p}><b>What to bring:</b> {d.whatToBring}</Text>}
      <Button href={`${SITE}/account`} style={cta}>See your booking</Button>
    </Layout>
  );
}

export function InstalmentReceiptEmail(d: { parentName: string; ref: string; amount: string; seq: number; count: number; remaining: string }) {
  return (
    <Layout preview={`Payment received for ${d.ref}`} title="Payment received">
      <Text style={p}>Hi {d.parentName.split(" ")[0]}, we&apos;ve taken instalment {d.seq} of {d.count} ({d.amount}) for booking <b>{d.ref}</b>.</Text>
      <Text style={p}>{d.remaining}</Text>
      <Button href={`${SITE}/account`} style={cta}>View receipts</Button>
    </Layout>
  );
}

export function PaymentFailedEmail(d: { parentName: string; ref: string; amount: string; reason: string; retry: string }) {
  return (
    <Layout preview={`We couldn't take a payment for ${d.ref}`} title="We couldn't take your payment">
      <Text style={p}>Hi {d.parentName.split(" ")[0]}, a scheduled payment of {d.amount} for booking <b>{d.ref}</b> didn&apos;t go through ({d.reason}).</Text>
      <Text style={p}>{d.retry}</Text>
      <Text style={p}>You can pay now, or use a different card, from your account.</Text>
      <Button href={`${SITE}/account`} style={cta}>Pay now</Button>
    </Layout>
  );
}

export function CampReminderEmail(d: { parentName: string; school: string; address: string | null; date: string; times: string; children: string[]; whatToBring: string | null }) {
  return (
    <Layout preview={`See you tomorrow at ${d.school}`} title="See you tomorrow">
      <Text style={p}>Hi {d.parentName.split(" ")[0]}, a quick reminder that {d.children.join(" and ")} {d.children.length > 1 ? "are" : "is"} booked in tomorrow.</Text>
      <Text style={row}><b>{d.date}</b> · {d.times}</Text>
      <Text style={{ ...row, marginBottom: 12 }}>{d.school}{d.address ? `, ${d.address}` : ""}</Text>
      {d.whatToBring && <Text style={p}><b>What to bring:</b> {d.whatToBring}</Text>}
      <Text style={p}>Your pickup pass is in the Prime Camps app. Only adults named on the booking can collect.</Text>
      <Button href={`${SITE}/app`} style={cta}>Open the app</Button>
    </Layout>
  );
}

export function BookingCancelledEmail(d: { parentName: string; ref: string; school: string; refund: string | null }) {
  return (
    <Layout preview={`Booking ${d.ref} cancelled`} title="Booking cancelled">
      <Text style={p}>Hi {d.parentName.split(" ")[0]}, your booking <b>{d.ref}</b> at {d.school} has been cancelled.</Text>
      <Text style={p}>{d.refund ? `A refund of ${d.refund} is on its way to your card. It can take 5 to 10 working days to appear.` : "No refund is due on this booking under our booking terms."}</Text>
      <Text style={p}>Questions? Reply to this email or contact admin@primesportsuk.org.</Text>
    </Layout>
  );
}

export function WaitingListOfferEmail(d: { parentName: string; school: string; date: string; slug: string }) {
  return (
    <Layout preview={`A space has opened up at ${d.school}`} title="A space has opened up">
      <Text style={p}>Hi {d.parentName.split(" ")[0]}, good news: a space has opened up at {d.school} on {d.date}.</Text>
      <Text style={p}>Spaces go to the first family to book, so book soon if you&apos;d like it.</Text>
      <Button href={`${SITE}/book/${d.slug}`} style={cta}>Book now</Button>
    </Layout>
  );
}

export function NoticeEmail(d: { title: string; preview?: string; lines: string[]; buttonLabel?: string; buttonHref?: string }) {
  return (
    <Layout preview={d.preview || d.title} title={d.title}>
      {d.lines.map((l, i) => <Text key={i} style={p}>{l}</Text>)}
      {d.buttonHref && <Button href={d.buttonHref.startsWith("http") ? d.buttonHref : `${SITE}${d.buttonHref}`} style={cta}>{d.buttonLabel || "Open"}</Button>}
    </Layout>
  );
}

export function OwnerNotificationEmail(d: { title: string; rows: [string, string][]; link?: string }) {
  return (
    <Layout preview={d.title} title={d.title}>
      {d.rows.map(([a, b]) => <Text key={a} style={row}><b>{a}:</b> {b || "—"}</Text>)}
      {d.link && <Button href={`${SITE}${d.link}`} style={{ ...cta, marginTop: 12 }}>Open in admin</Button>}
    </Layout>
  );
}
