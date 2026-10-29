"use client";
import { useFormAction } from "@/lib/use-form-action";

import { submitLead, type LeadKind, type LeadState } from "@/app/actions/leads";
import { AREAS, SCHOOL_INTERESTS } from "@/lib/validation";
import { Turnstile } from "./Turnstile";

const DONE: Record<LeadKind, [string, string]> = {
  early_access: ["You're on the list", "We'll email you as soon as February bookings open."],
  goat: ["You're on the waiting list", "We'll be in touch before sessions open in 2027."],
  school: ["Thanks, we've got your enquiry", "We'll be in touch within two working days."],
  contact: ["Thanks for your message", "We'll get back to you as soon as we can."],
};

const SUBMIT: Record<LeadKind, [string, string]> = {
  early_access: ["Get early access", "Signing you up…"],
  goat: ["Join the waiting list", "Adding you…"],
  school: ["Send enquiry", "Sending…"],
  contact: ["Send message", "Sending…"],
};

export function LeadForm({ kind }: { kind: LeadKind }) {
  const [state, action, pending] = useFormAction<LeadState>(submitLead.bind(null, kind), { ok: false });
  const id = (f: string) => `${kind}-${f}`;

  if (state.ok) {
    return (
      <div className="form-card" role="status">
        <div className="form-done">
          <span className="tick" aria-hidden="true">✓</span>
          <h3>{DONE[kind][0]}</h3>
          <p>{DONE[kind][1]}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={action} noValidate>
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label>Leave this empty<input name="company_website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {(kind === "early_access" || kind === "goat") && (
        <>
          <div className="form-row">
            <label className="field" htmlFor={id("name")}>Your first name<input id={id("name")} name="first_name" autoComplete="given-name" required /></label>
            <label className="field" htmlFor={id("email")}>Email<input id={id("email")} name="email" type="email" autoComplete="email" required /></label>
          </div>
          <div className="form-row">
            <label className="field" htmlFor={id("area")}>Your area
              <select id={id("area")} name="area" required defaultValue="">
                <option value="">Choose…</option>
                {AREAS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            {kind === "early_access" ? (
              <label className="field" htmlFor={id("kids")}>Children&apos;s ages<input id={id("kids")} name="children_ages" placeholder="e.g. 6 and 9" /></label>
            ) : (
              <label className="field" htmlFor={id("age")}>Player&apos;s age<input id={id("age")} name="player_age" placeholder="e.g. 9" inputMode="numeric" /></label>
            )}
          </div>
          <label className="chk" htmlFor={id("consent")}>
            <input type="checkbox" id={id("consent")} name="consent" />
            <span>{kind === "early_access" ? "Email me about Prime Camps bookings and offers. I can unsubscribe at any time." : "Email me about G.O.A.T Football Academy. I can unsubscribe at any time."}</span>
          </label>
        </>
      )}

      {kind === "school" && (
        <>
          <label className="field" htmlFor={id("school")}>School name<input id={id("school")} name="school_name" autoComplete="organization" required /></label>
          <div className="form-row">
            <label className="field" htmlFor={id("contact")}>Your name<input id={id("contact")} name="contact_name" autoComplete="name" required /></label>
            <label className="field" htmlFor={id("role")}>Your role<input id={id("role")} name="role" placeholder="e.g. PE lead, Bursar" /></label>
          </div>
          <div className="form-row">
            <label className="field" htmlFor={id("email")}>Email<input id={id("email")} name="email" type="email" autoComplete="email" required /></label>
            <label className="field" htmlFor={id("phone")}>Phone<input id={id("phone")} name="phone" type="tel" autoComplete="tel" /></label>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: ".4rem" }}>What are you interested in?</legend>
            <div className="grid2">
              {SCHOOL_INTERESTS.map((i) => (
                <label key={i} className="chk"><input type="checkbox" name="interests" value={i} /> <span>{i}</span></label>
              ))}
            </div>
          </fieldset>
          <label className="field" htmlFor={id("msg")}>Anything else?<textarea id={id("msg")} name="message" /></label>
          <label className="chk" htmlFor={id("consent")}>
            <input type="checkbox" id={id("consent")} name="consent" />
            <span>I&apos;m happy for Prime Sports UK to contact me about this enquiry.</span>
          </label>
        </>
      )}

      {kind === "contact" && (
        <>
          <div className="form-row">
            <label className="field" htmlFor={id("name")}>Your name<input id={id("name")} name="name" autoComplete="name" required /></label>
            <label className="field" htmlFor={id("email")}>Email<input id={id("email")} name="email" type="email" autoComplete="email" required /></label>
          </div>
          <label className="field" htmlFor={id("phone")}>Phone (optional)<input id={id("phone")} name="phone" type="tel" autoComplete="tel" /></label>
          <label className="field" htmlFor={id("msg")}>Message<textarea id={id("msg")} name="message" required /></label>
          <label className="chk" htmlFor={id("consent")}>
            <input type="checkbox" id={id("consent")} name="consent" />
            <span>I&apos;m happy for Prime Sports UK to reply to me about this message.</span>
          </label>
        </>
      )}

      <Turnstile />
      <p className="err" role="alert">{state.error}</p>
      <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
        {pending ? SUBMIT[kind][1] : SUBMIT[kind][0]}
      </button>
      <p className="form-note">
        {kind === "early_access"
          ? "We only use your details to tell you about Prime Camps. We never share them."
          : "We only use your details for this. We never share them. See our privacy policy."}
      </p>
    </form>
  );
}
