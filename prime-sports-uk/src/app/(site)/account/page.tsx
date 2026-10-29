import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { dateRange, gbp, longDate, todayLondon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AccountForms, DeleteData, MembershipButtons, PayInstalmentButton } from "./AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

type BookingRow = {
  id: string; ref: string; status: string; plan: string; total_pence: number; amount_paid_pence: number; amount_refunded_pence: number; instalment_count: number;
  camps: { school: string; area: string; slug: string };
  booking_places: { camp_days: { date: string }; children: { first_name: string } }[];
  instalments: { id: string; seq: number; due_date: string; amount_pence: number; status: string; last_error: string | null }[];
  payments: { amount_pence: number; created_at: string; receipt_url: string | null }[];
};

export default async function AccountPage() {
  const viewer = await requireViewer("/account");
  const supabase = await createClient();
  const [{ data: profile }, { data: children }, { data: bookings }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email, emergency_name, emergency_phone, emergency_relationship, notification_prefs").eq("id", viewer.id).single(),
    supabase.from("children").select("id, first_name, last_name, dob, medical, allergies, send, photo_consent").eq("parent_id", viewer.id).order("first_name"),
    supabase.from("bookings").select("id, ref, status, plan, total_pence, amount_paid_pence, amount_refunded_pence, instalment_count, camps(school, area, slug), booking_places(camp_days(date), children(first_name)), instalments(id, seq, due_date, amount_pence, status, last_error), payments(amount_pence, created_at, receipt_url)").eq("parent_id", viewer.id).in("status", ["confirmed", "cancelled"]).order("created_at", { ascending: false }),
    supabase.from("memberships").select("id, status, paused, cancel_at_period_end, current_period_end, last_payment_failed_at, children(first_name), membership_tiers(name, price_pence, membership_products(name))").eq("parent_id", viewer.id).order("created_at", { ascending: false }),
  ]);
  const today = todayLondon();
  const rows = (bookings ?? []) as unknown as BookingRow[];
  const dates = (b: BookingRow) => [...new Set(b.booking_places.map((p) => p.camp_days.date))].sort();
  const upcoming = rows.filter((b) => b.status === "confirmed" && dates(b).some((d) => d >= today));
  const past = rows.filter((b) => !upcoming.includes(b));

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">My account</div>
          <h1>Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
          <p>{viewer.email}</p>
          <div className="actions">
            <Link className="btn" href="/app">Open the Prime Camps app</Link>
            {viewer.role !== "parent" && <Link className="btn ghost" href="/admin">Admin</Link>}
            <form action="/auth/signout" method="post"><button className="btn ghost" type="submit">Sign out</button></form>
          </div>
        </div>
      </div>
      <section className="account">
        <div className="wrap" style={{ display: "grid", gap: "2rem" }}>
          <div>
            <h2>Upcoming bookings</h2>
            {upcoming.length === 0 && <p className="muted">No upcoming bookings. <Link href="/camps">Find a camp</Link>.</p>}
            <div className="acc-grid">{upcoming.map((b) => <BookingCard key={b.id} b={b} dates={dates(b)} />)}</div>
          </div>

          <div id="children">
            <div className="row"><h2>Your children</h2><Link className="btn small" href="/account/children/new">+ Add a child</Link></div>
            {!children?.length && <p className="muted">Children you add or book are saved here, so you never have to retype their details.</p>}
            <div className="acc-grid">
              {(children ?? []).map((c) => (
                <div className="card" key={c.id}>
                  <div className="kid-head"><span className="av" aria-hidden="true">{c.first_name[0]}{c.last_name[0]}</span><h3 style={{ flex: 1 }}>{c.first_name} {c.last_name}</h3></div>
                  <p className="muted">Born {longDate(c.dob)}</p>
                  <div className="chips">
                    {(c.medical || c.allergies) && <span className="tag med">Medical or allergy info</span>}
                    {c.send && <span className="tag gold">SEND info</span>}
                    <span className={`tag ${c.photo_consent ? "ok" : "ph"}`}>{c.photo_consent ? "Photos OK" : "No photos"}</span>
                  </div>
                  <Link className="btn ghost small" href={`/account/children/${c.id}`}>Edit details</Link>
                </div>
              ))}
            </div>
          </div>

          {(memberships ?? []).length > 0 && (
            <div>
              <h2>Memberships</h2>
              <div className="acc-grid">
                {(memberships ?? []).map((m) => {
                  const mm = m as unknown as { id: string; status: string; paused: boolean; cancel_at_period_end: boolean; current_period_end: string | null; last_payment_failed_at: string | null; children: { first_name: string } | null; membership_tiers: { name: string; price_pence: number; membership_products: { name: string } } };
                  return (
                    <div className="card" key={mm.id}>
                      <h3>{mm.membership_tiers.membership_products.name}</h3>
                      <p>{mm.children?.first_name ? `${mm.children.first_name} · ` : ""}{mm.membership_tiers.name} · {gbp(mm.membership_tiers.price_pence)}/month</p>
                      <p className="muted">
                        {mm.status === "cancelled" ? "Cancelled" : mm.paused ? "Paused: no payments are taken" : mm.cancel_at_period_end ? `Ends ${mm.current_period_end ? longDate(mm.current_period_end.slice(0, 10)) : "at the end of this period"}` : mm.current_period_end ? `Next payment ${longDate(mm.current_period_end.slice(0, 10))}` : mm.status}
                      </p>
                      {mm.last_payment_failed_at && <p className="err">Your last payment failed. Please update your card.</p>}
                      {mm.status !== "cancelled" && <MembershipButtons id={mm.id} paused={mm.paused} cancelling={mm.cancel_at_period_end} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2>Past and cancelled bookings</h2>
              <div className="acc-grid">{past.map((b) => <BookingCard key={b.id} b={b} dates={dates(b)} />)}</div>
            </div>
          )}

          <AccountForms
            profile={{
              full_name: profile?.full_name ?? "", phone: profile?.phone ?? "", emergency_name: profile?.emergency_name ?? "",
              emergency_phone: profile?.emergency_phone ?? "", emergency_relationship: profile?.emergency_relationship ?? "",
              prefs: (profile?.notification_prefs ?? {}) as Record<string, boolean>,
            }}
          />

          <div className="card">
            <h2 className="h3-size">Your data</h2>
            <p className="muted">Download everything we hold about you and your children, or delete it. Payment records are kept, without your name, for 6 years for tax purposes.</p>
            <a className="btn ghost" href="/account/export" download>Download my data</a>
            <DeleteData />
          </div>
        </div>
      </section>
    </>
  );
}

function BookingCard({ b, dates }: { b: BookingRow; dates: string[] }) {
  const kids = [...new Set(b.booking_places.map((p) => p.children.first_name))];
  const inst = [...b.instalments].sort((x, y) => x.seq - y.seq);
  return (
    <div className="card">
      <div className="row"><span className="ref" style={{ fontSize: "1rem" }}>{b.ref}</span><span className={`tag ${b.status === "confirmed" ? "ok" : "ph"}`}>{b.status === "confirmed" ? "Booked" : "Cancelled"}</span></div>
      <h3><Link href={`/camps/${b.camps.slug}`}>{b.camps.school}</Link></h3>
      <p>{dateRange(dates)} · {kids.join(", ")}</p>
      <p className="muted">Paid {gbp(b.amount_paid_pence)} of {gbp(b.total_pence)}{b.amount_refunded_pence ? ` · refunded ${gbp(b.amount_refunded_pence)}` : ""}</p>
      {b.plan === "instalments" && (
        <div className="sched">
          <b>Payment schedule</b>
          {inst.map((i) => (
            <div key={i.id}>
              <span>{longDate(i.due_date)}</span>
              <span>{gbp(i.amount_pence)} · {i.status === "paid" ? "Paid" : i.status === "failed" ? "Failed" : i.status === "cancelled" ? "Cancelled" : "Scheduled"}</span>
            </div>
          ))}
          {inst.filter((i) => i.status === "failed").map((i) => (
            <div key={`pay-${i.id}`} style={{ display: "grid", gap: ".4rem" }}>
              <span className="err">Payment {i.seq} didn&apos;t go through{i.last_error ? ` (${i.last_error})` : ""}.</span>
              <PayInstalmentButton id={i.id} amount={gbp(i.amount_pence)} />
            </div>
          ))}
        </div>
      )}
      {b.payments.some((p) => p.receipt_url) && (
        <p className="hint">Receipts: {b.payments.filter((p) => p.receipt_url).map((p, i) => <a key={i} href={p.receipt_url!} target="_blank" rel="noopener" style={{ marginRight: ".6rem" }}>{gbp(p.amount_pence)} ({new Date(p.created_at).toLocaleDateString("en-GB")})</a>)}</p>
      )}
    </div>
  );
}
