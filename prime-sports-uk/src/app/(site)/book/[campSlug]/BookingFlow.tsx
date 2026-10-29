"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { checkDiscountCode, fakePay, startBooking, type StartResult } from "@/app/actions/booking";
import { refreshHold } from "@/app/actions/hold";
import { SchoolLogo } from "@/components/CampCard";
import { WaitingListForm } from "@/components/WaitingListForm";
import { ageOn, fmtDate, gbp, longDate, shortDay, timeRange } from "@/lib/format";
import { instalmentOptions, instalmentSchedule, quote, spaceLevel, spacesLeft, type DiscountCode, type InstalmentRules } from "@/lib/pricing";
import { childSchema, parentSchema, type ChildInput, type ParentInput } from "@/lib/validation";

type CampInfo = {
  slug: string; school: string; area: string; age_min: number; age_max: number; start_time: string; end_time: string;
  price_per_day_pence: number; full_week_price_pence: number | null; logo_path: string | null; photo_path: string | null; total_days: number;
};
type Day = { day_id: string; date: string; capacity: number; taken: number };
export type SavedChild = { id: string; first_name: string; last_name: string; dob: string; school: string | null; medical: string | null; allergies: string | null; send: string | null; photo_consent: boolean; collectors: string[] };
export type SavedParent = { full_name: string | null; email: string | null; phone: string | null; emergency_name: string | null; emergency_phone: string | null; emergency_relationship: string | null };
type Payments = { mode: "stripe"; key: string } | { mode: "fake" } | { mode: "off" };
type Kid = Omit<ChildInput, "photo_consent"> & { photo_consent: "" | "yes" | "no" };

const STEPS = ["Choose camp & days", "Who's coming", "Your details", "Payment", "Confirmed"];
const blankKid = (): Kid => ({ first_name: "", last_name: "", dob: "", school: "", medical: "", allergies: "", send: "", collectors: "", photo_consent: "" });
let stripePromise: Promise<Stripe | null> | null = null;

export function BookingFlow(props: {
  camp: CampInfo; days: Day[]; siblingPct: number; rules: InstalmentRules; today: string; signedIn: boolean;
  savedChildren: SavedChild[]; savedParent: SavedParent | null; payments: Payments;
}) {
  const { camp, days, siblingPct, rules, today, savedChildren, savedParent, payments } = props;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [kids, setKids] = useState<Kid[]>(savedChildren.length ? [] : [blankKid()]);
  const [parent, setParent] = useState<ParentInput>({
    name: savedParent?.full_name ?? "", phone: savedParent?.phone ?? "", email: savedParent?.email ?? "",
    emergency_name: savedParent?.emergency_name ?? "", emergency_phone: savedParent?.emergency_phone ?? "",
    emergency_relationship: savedParent?.emergency_relationship ?? "",
  });
  const [plan, setPlan] = useState<"full" | number>("full");
  const [codeText, setCodeText] = useState("");
  const [code, setCode] = useState<DiscountCode | null>(null);
  const [codeError, setCodeError] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [showWaiting, setShowWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Extract<StartResult, { ok: true }> | null>(null);
  const [decline, setDecline] = useState(false);

  const chosenDates = days.filter((d) => picked.includes(d.day_id)).map((d) => d.date).sort();
  const firstDay = chosenDates[0];
  const q = quote({
    pricePerDayPence: camp.price_per_day_pence, fullWeekPricePence: camp.full_week_price_pence, campDayCount: camp.total_days,
    selectedDayCount: picked.length, childCount: Math.max(1, kids.length), siblingPct, code,
  });
  const options = firstDay ? instalmentOptions(today, firstDay, rules) : [];
  const effectivePlan: "full" | number = plan !== "full" && options.includes(plan) ? plan : "full";
  const schedule = instalmentSchedule(q.totalPence, effectivePlan === "full" ? 1 : effectivePlan, today);
  const dueNow = schedule[0]?.amountPence ?? 0;
  const fullDays = days.filter((d) => spaceLevel(d) === "full");

  // Any change to the order after a hold was made means we need a fresh hold.
  const invalidate = () => setPending(null);
  const go = (n: number) => { setError(""); setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const fail = (m: string) => { setError(m); requestAnimationFrame(() => document.getElementById("bk-err")?.scrollIntoView({ block: "center", behavior: "smooth" })); return false; };

  function checkKids(): boolean {
    if (!kids.length) return fail("Add at least one child.");
    for (const [i, k] of kids.entries()) {
      const label = k.first_name || `Child ${i + 1}`;
      const r = childSchema.safeParse(k);
      if (!r.success) return fail(`${label}: ${r.error.issues[0].message}`);
      const age = ageOn(k.dob, firstDay);
      if (age < camp.age_min || age > camp.age_max) return fail(`${k.first_name} will be ${age} on the first day. This camp is for ages ${camp.age_min}–${camp.age_max}.`);
    }
    return true;
  }
  function checkParent(): boolean {
    const r = parentSchema.safeParse(parent);
    if (!r.success) return fail(r.error.issues[0].message);
    return true;
  }

  async function applyCode() {
    setCodeError("");
    if (!codeText.trim()) { setCode(null); invalidate(); return; }
    const r = await checkDiscountCode(camp.slug, codeText);
    invalidate();
    if (r.ok) setCode(r.code as DiscountCode);
    else { setCode(null); setCodeError(r.error); }
  }

  function payload() {
    return {
      camp_slug: camp.slug,
      day_ids: picked,
      children: kids.map((k) => ({ ...k, photo_consent: k.photo_consent as "yes" | "no" })),
      parent,
      plan: effectivePlan,
      code: code?.code ?? "",
      terms: true as const,
    };
  }

  /** Creates (or reuses) the held booking. Returns null and shows an error when it can't. */
  async function ensureBooking() {
    if (pending) {
      const live = await refreshHold(pending.bookingId);
      if (live) return pending;
    }
    const res = await startBooking(payload());
    if (!res.ok) { fail(res.error); return null; }
    setPending(res);
    return res;
  }

  function finish(ref: string) {
    router.push(`/book/confirmed/${ref}`);
  }

  async function payFake() {
    if (!terms) return fail("Tick the box to agree to the booking terms.");
    setBusy(true); setError("");
    const res = await ensureBooking();
    if (!res) return setBusy(false);
    if (res.mode === "free") return finish(res.ref);
    const r = await fakePay(res.bookingId, decline);
    setBusy(false);
    if (!r.ok) return fail(r.error);
    finish(res.ref);
  }

  const basket = (
    <aside className="card basket" aria-label="Your basket">
      <h2 className="h3-size" style={{ textTransform: "none", fontFamily: "var(--body)", fontWeight: 800, fontSize: "1.05rem" }}>Your basket</h2>
      <div style={{ display: "flex", gap: ".7rem", alignItems: "center" }}>
        <span className="av dark">{camp.school.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 3).map((w) => w[0]).join("")}</span>
        <div><b>{camp.school}</b><p className="hint">{camp.area} · {timeRange(camp.start_time, camp.end_time)}</p></div>
      </div>
      {picked.length ? (
        <div className="chips">{chosenDates.map((d) => <span key={d} className="tag gold">{shortDay(d)}</span>)}</div>
      ) : <p className="hint">No days picked yet.</p>}
      {picked.length > 0 && kids.map((k, i) => (
        <div className="line" key={i}><span>{(k.first_name || `Child ${i + 1}`)} · {picked.length} day{picked.length > 1 ? "s" : ""}</span><span>{gbp(q.perChildPence)}</span></div>
      ))}
      {q.usesFullWeekPrice && <p className="hint">Full-week price applied.</p>}
      {q.siblingDiscountPence > 0 && <div className="line disc"><span>Sibling discount</span><span>−{gbp(q.siblingDiscountPence)}</span></div>}
      {q.codeDiscountPence > 0 && <div className="line disc"><span>{code?.label || code?.code}</span><span>−{gbp(q.codeDiscountPence)}</span></div>}
      <div className="line total"><span>Total</span><span>{gbp(picked.length ? q.totalPence : 0)}</span></div>
      {step >= 3 && effectivePlan !== "full" && <div className="today"><span>Due today</span><span>{gbp(dueNow)}</span></div>}
      <div className="trust"><span>✓ Secure card payments</span><span>✓ Pay in instalments on camps booked early</span>{siblingPct > 0 && <span>✓ Sibling discount applied automatically</span>}</div>
    </aside>
  );

  const progress = (
    <div>
      <p className="stepname">Step {Math.min(step + 1, STEPS.length)} of {STEPS.length} · {STEPS[step]}</p>
      <div className="progress" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
    </div>
  );

  return (
    <div className="bk wrap">
      <div className="bk-layout">
        <div className="bk-stage">
          {progress}

          {step === 0 && (
            <>
              <h1>Book a holiday camp</h1>
              <div className="card">
                <div className="camp-pick">
                  <SchoolLogo school={camp.school} logoPath={camp.logo_path} size={64} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: "1.6rem" }}>{camp.school}</h2>
                    <p className="muted">{camp.area} · Ages {camp.age_min}–{camp.age_max} · {timeRange(camp.start_time, camp.end_time)} · {gbp(camp.price_per_day_pence)} a day</p>
                  </div>
                </div>
                <Link className="link" href="/camps">Choose a different camp</Link>
              </div>
              <div className="card">
                <div className="row">
                  <div><h2>Pick your days</h2><p className="muted">Tap the days you&apos;d like.</p></div>
                  <button type="button" className="link" onClick={() => { setPicked(days.filter((d) => spacesLeft(d) > 0).map((d) => d.day_id)); invalidate(); }}>Select all days</button>
                </div>
                <div className="days" role="group" aria-label="Camp days">
                  {days.map((d) => {
                    const left = spacesLeft(d);
                    const on = picked.includes(d.day_id);
                    return (
                      <button
                        key={d.day_id}
                        type="button"
                        className="day"
                        aria-pressed={on}
                        disabled={left <= 0}
                        aria-label={`${longDate(d.date)}, ${left <= 0 ? "full" : `${left} spaces left`}`}
                        onClick={() => { setPicked((p) => (on ? p.filter((x) => x !== d.day_id) : [...p, d.day_id])); invalidate(); }}
                      >
                        <span className="dw">{fmtDate(d.date, { weekday: "short" })}</span>
                        <span className="dn">{fmtDate(d.date, { day: "numeric" })}</span>
                        <span className="dm">{fmtDate(d.date, { month: "short" })}</span>
                        <span className={`sp ${spaceLevel(d)}`}>{left <= 0 ? "Full" : `${left} left`}</span>
                      </button>
                    );
                  })}
                </div>
                {fullDays.length > 0 && (
                  <div style={{ display: "grid", gap: ".8rem" }}>
                    <button type="button" className="link" style={{ justifySelf: "start" }} onClick={() => setShowWaiting((s) => !s)} aria-expanded={showWaiting}>
                      {fullDays.length === 1 ? "That day is full." : "Some days are full."} Join the waiting list
                    </button>
                    {showWaiting && <WaitingListForm days={fullDays.map((d) => ({ id: d.day_id, label: longDate(d.date) }))} />}
                  </div>
                )}
                <button className="btn" type="button" disabled={!picked.length} onClick={() => go(1)}>Continue</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Who&apos;s coming?</h1>
              <p className="muted">Add each child.{siblingPct > 0 ? ` Brothers and sisters get ${siblingPct}% off.` : ""}</p>
              {savedChildren.length > 0 && (
                <div className="card">
                  <h2 className="h3-size">Your saved children</h2>
                  <div className="saved-kids">
                    {savedChildren.map((s) => {
                      const added = kids.some((k) => k.id === s.id);
                      return (
                        <button key={s.id} type="button" className="chip" aria-pressed={added} onClick={() => {
                          invalidate();
                          if (added) setKids((ks) => ks.filter((k) => k.id !== s.id));
                          else setKids((ks) => [...ks.filter((k) => k.first_name || k.id), {
                            id: s.id, first_name: s.first_name, last_name: s.last_name, dob: s.dob, school: s.school ?? "",
                            medical: s.medical ?? "", allergies: s.allergies ?? "", send: s.send ?? "",
                            collectors: s.collectors.join(", "), photo_consent: s.photo_consent ? "yes" : "no",
                          }]);
                        }}>
                          {added ? "✓ " : "+ "}{s.first_name} {s.last_name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="hint">Check their details below are still right. Changes are saved to your account.</p>
                </div>
              )}
              {kids.map((k, i) => (
                <KidCard key={k.id ?? `new-${i}`} kid={k} index={i} removable={kids.length > 1 || savedChildren.length > 0} firstDay={firstDay} camp={camp}
                  onChange={(next) => { invalidate(); setKids((ks) => ks.map((x, j) => (j === i ? next : x))); }}
                  onRemove={() => { invalidate(); setKids((ks) => ks.filter((_, j) => j !== i)); }} />
              ))}
              <button type="button" className="btn ghost" onClick={() => { invalidate(); setKids((ks) => [...ks, blankKid()]); }}>+ Add {kids.length ? "another" : "a"} child</button>
              <p className="err" id="bk-err" role="alert">{error}</p>
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => go(0)}>Back</button>
                <button type="button" className="btn" onClick={() => checkKids() && go(2)}>Continue</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Your details</h1>
              <div className="card">
                <h2 className="h3-size">About you</h2>
                <div className="grid2">
                  <Field label="Full name" value={parent.name} autoComplete="name" onChange={(v) => { invalidate(); setParent({ ...parent, name: v }); }} />
                  <Field label="Mobile number" type="tel" value={parent.phone} autoComplete="tel" onChange={(v) => { invalidate(); setParent({ ...parent, phone: v }); }} />
                </div>
                <Field label="Email" type="email" value={parent.email} autoComplete="email" hint={props.signedIn ? "Your confirmation and receipts go here." : "Your confirmation and receipts go here. You can sign in with this email later to manage your booking."} onChange={(v) => { invalidate(); setParent({ ...parent, email: v }); }} />
              </div>
              <div className="card">
                <h2 className="h3-size">Emergency contact</h2>
                <p className="hint">Someone other than you, in case we can&apos;t reach you.</p>
                <div className="grid2">
                  <Field label="Name" value={parent.emergency_name} onChange={(v) => { invalidate(); setParent({ ...parent, emergency_name: v }); }} />
                  <Field label="Phone" type="tel" value={parent.emergency_phone} onChange={(v) => { invalidate(); setParent({ ...parent, emergency_phone: v }); }} />
                </div>
                <Field label="Relationship to the child" placeholder="e.g. Grandparent" value={parent.emergency_relationship ?? ""} onChange={(v) => { invalidate(); setParent({ ...parent, emergency_relationship: v }); }} />
              </div>
              <p className="err" id="bk-err" role="alert">{error}</p>
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => go(1)}>Back</button>
                <button type="button" className="btn" onClick={() => checkParent() && go(3)}>Continue to payment</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>How would you like to pay?</h1>
              <div className="plans" role="radiogroup" aria-label="Payment plan">
                <button type="button" role="radio" className="plan" aria-checked={effectivePlan === "full"} onClick={() => { invalidate(); setPlan("full"); }}>
                  <span className="radio" /><span><b>Pay in full</b><span className="hint">One payment today</span></span><b>{gbp(q.totalPence)}</b>
                </button>
                {Array.from({ length: Math.max(1, rules.max_count - 1) }, (_, i) => i + 2).map((n) => {
                  const ok = options.includes(n);
                  const s = instalmentSchedule(q.totalPence, n, today);
                  return (
                    <button key={n} type="button" role="radio" className="plan" aria-checked={effectivePlan === n} disabled={!ok || q.totalPence === 0} onClick={() => { invalidate(); setPlan(n); }}>
                      <span className="radio" />
                      <span><b>Pay in {n} monthly instalments</b><span className="hint">{ok ? `${gbp(s[0].amountPence)} today, then ${gbp(s[1].amountPence)} a month` : "Not available: camp starts too soon"}</span></span>
                      <b>{ok ? gbp(s[0].amountPence) : ""}</b>
                    </button>
                  );
                })}
              </div>
              {effectivePlan !== "full" && (
                <div className="sched">
                  <b>Your payment schedule</b>
                  {schedule.map((r) => <div key={r.seq}><span>{r.seq === 1 ? "Today" : longDate(r.dueDate)}</span><span>{gbp(r.amountPence)}</span></div>)}
                  <span className="hint">Payments are taken automatically from the same card. All instalments finish before the camp starts.</span>
                </div>
              )}
              <div className="field">
                <label htmlFor="code">Discount code</label>
                <span style={{ display: "flex", gap: ".5rem" }}>
                  <input id="code" className="input" value={codeText} onChange={(e) => setCodeText(e.target.value)} placeholder="e.g. EARLYBIRD" autoCapitalize="characters" />
                  <button type="button" className="btn dark" onClick={applyCode}>Apply</button>
                </span>
              </div>
              {codeError && <p className="err">{codeError}</p>}
              {code && <p className="tag ok" style={{ justifySelf: "start" }}>{code.label || code.code} applied</p>}

              <label className="chk">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  I agree to the <Link href="/booking-terms" target="_blank">booking terms, cancellation policy</Link> and <Link href="/privacy" target="_blank">privacy notice</Link>
                  {effectivePlan !== "full" ? ", and authorise the scheduled instalment payments" : ""}.
                </span>
              </label>

              {payments.mode === "stripe" && q.totalPence > 0 && (
                <StripePay key={`${effectivePlan}`} publishableKey={payments.key} amount={dueNow} saveCard={effectivePlan !== "full"}
                  disabled={busy} setBusy={setBusy} terms={terms} fail={fail} ensureBooking={ensureBooking} onPaid={finish} />
              )}
              {payments.mode === "fake" && q.totalPence > 0 && (
                <div className="pay-box">
                  <div className="row"><b>Card details</b><div className="cardrow"><span>TEST MODE</span></div></div>
                  <p className="hint">Stripe isn&apos;t connected on this development copy, so no money is taken. The live site shows Stripe&apos;s secure card form here (cards, Apple Pay and Google Pay).</p>
                  <label className="chk"><input type="checkbox" checked={decline} onChange={(e) => setDecline(e.target.checked)} /><span>Simulate a declined card</span></label>
                </div>
              )}
              {payments.mode === "off" && q.totalPence > 0 && <p className="err">Online payments aren&apos;t set up yet. Please contact us to book.</p>}

              <p className="err" id="bk-err" role="alert">{error}</p>
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => go(2)}>Back</button>
                {(payments.mode === "fake" || q.totalPence === 0) && (
                  <button type="button" className="btn" disabled={busy} onClick={payFake}>
                    {busy ? "Processing…" : q.totalPence === 0 ? "Confirm booking" : `Pay ${gbp(dueNow)} now`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {basket}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", hint, placeholder, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; placeholder?: string; autoComplete?: string;
}) {
  return (
    <label className="field">{label}
      <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function KidCard({ kid, index, removable, onChange, onRemove, firstDay, camp }: {
  kid: Kid; index: number; removable: boolean; onChange: (k: Kid) => void; onRemove: () => void; firstDay: string; camp: CampInfo;
}) {
  const set = (k: keyof Kid) => (v: string) => onChange({ ...kid, [k]: v });
  const init = ((kid.first_name[0] || "") + (kid.last_name[0] || "")).toUpperCase() || String(index + 1);
  const age = kid.dob && firstDay ? ageOn(kid.dob, firstDay) : null;
  const outOfRange = age !== null && (age < camp.age_min || age > camp.age_max);
  return (
    <div className="card">
      <div className="kid-head">
        <span className="av" aria-hidden="true">{init}</span>
        <h2 className="h3-size" style={{ flex: 1, fontSize: "1.3rem" }}>{kid.first_name ? `${kid.first_name} ${kid.last_name}` : `Child ${index + 1}`}</h2>
        {removable && <button type="button" className="link" onClick={onRemove}>Remove<span className="sr-only"> {kid.first_name || `child ${index + 1}`}</span></button>}
      </div>
      <div className="grid2">
        <Field label="First name" value={kid.first_name} onChange={set("first_name")} autoComplete="off" />
        <Field label="Surname" value={kid.last_name} onChange={set("last_name")} autoComplete="off" />
        <label className="field">Date of birth
          <input type="date" value={kid.dob} max={firstDay} onChange={(e) => onChange({ ...kid, dob: e.target.value })} />
          {outOfRange && <span className="hint" style={{ color: "var(--bad)" }}>{kid.first_name || "They"} will be {age} on the first day. This camp is for ages {camp.age_min}–{camp.age_max}.</span>}
        </label>
        <Field label="School they attend" value={kid.school ?? ""} onChange={set("school")} />
      </div>
      <label className="field">Medical conditions
        <textarea value={kid.medical ?? ""} placeholder="Leave blank if none" onChange={(e) => set("medical")(e.target.value)} />
      </label>
      <div className="grid2">
        <Field label="Allergies" value={kid.allergies ?? ""} placeholder="Leave blank if none" onChange={set("allergies")} />
        <Field label="SEND or support needs" value={kid.send ?? ""} placeholder="Leave blank if none" onChange={set("send")} />
      </div>
      <Field label="Who can collect them?" value={kid.collectors} placeholder="Names of adults allowed to collect" hint="Separate names with commas." onChange={set("collectors")} />
      <div style={{ display: "grid", gap: ".4rem" }}>
        <span style={{ fontWeight: 700, fontSize: ".9rem" }} id={`photo-${index}`}>Can we use photos of them on social media and in the parent app?</span>
        <div className="seg" role="group" aria-labelledby={`photo-${index}`}>
          <button type="button" aria-pressed={kid.photo_consent === "yes"} onClick={() => onChange({ ...kid, photo_consent: "yes" })}>Yes, that&apos;s fine</button>
          <button type="button" aria-pressed={kid.photo_consent === "no"} onClick={() => onChange({ ...kid, photo_consent: "no" })}>No photos please</button>
        </div>
      </div>
    </div>
  );
}

function StripePay(props: {
  publishableKey: string; amount: number; saveCard: boolean; disabled: boolean; terms: boolean;
  setBusy: (b: boolean) => void; fail: (m: string) => boolean;
  ensureBooking: () => Promise<Extract<StartResult, { ok: true }> | null>; onPaid: (ref: string) => void;
}) {
  stripePromise ??= loadStripe(props.publishableKey);
  const options = useMemo(() => ({
    mode: "payment" as const,
    amount: props.amount,
    currency: "gbp",
    ...(props.saveCard ? { setupFutureUsage: "off_session" as const } : {}),
    appearance: { theme: "stripe" as const, variables: { colorPrimary: "#b38a1e", borderRadius: "12px", fontFamily: "system-ui, sans-serif" } },
  }), [props.amount, props.saveCard]);
  return (
    <Elements stripe={stripePromise} options={options}>
      <StripePayInner {...props} />
    </Elements>
  );
}

function StripePayInner({ amount, disabled, terms, setBusy, fail, ensureBooking, onPaid }: Parameters<typeof StripePay>[0]) {
  const stripe = useStripe();
  const elements = useElements();
  async function pay() {
    if (!stripe || !elements) return;
    if (!terms) return fail("Tick the box to agree to the booking terms.");
    setBusy(true);
    const { error: submitError } = await elements.submit();
    if (submitError) { setBusy(false); return fail(submitError.message || "Check your card details."); }
    const booking = await ensureBooking();
    if (!booking) return setBusy(false);
    if (booking.mode === "free") return onPaid(booking.ref);
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret: booking.clientSecret!,
      confirmParams: { return_url: `${window.location.origin}/book/confirmed/${booking.ref}` },
      redirect: "if_required",
    });
    if (error) { setBusy(false); return fail(error.message || "Your payment didn't go through. Please try again."); }
    onPaid(booking.ref);
  }
  return (
    <div className="pay-box">
      <div className="row"><b>Card details</b><div className="cardrow"><span>VISA</span><span>Mastercard</span><span>Apple Pay</span><span>Google Pay</span></div></div>
      <PaymentElement options={{ layout: "tabs" }} />
      <p className="hint">Payments are handled securely by Stripe. Your card details never touch our website.</p>
      <button type="button" className="btn" disabled={disabled || !stripe} onClick={pay}>{disabled ? "Processing…" : `Pay ${gbp(amount)} now`}</button>
    </div>
  );
}
