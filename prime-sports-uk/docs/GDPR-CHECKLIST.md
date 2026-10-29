# UK GDPR review checklist

Status as built. Items marked **Owner** need a decision or document from Prime Sports UK.

## What's in place

- [x] **Lawful basis recorded in the draft privacy policy**: contract (bookings), legal obligation (safeguarding records), explicit consent (medical, allergy and SEND details; photos), consent (marketing emails).
- [x] **Data minimisation**: medical, allergy and SEND fields are optional free text. Lead forms collect first name, email, area and ages only.
- [x] **Consent captured with a timestamp** on every public form (`consent_at`), and consent forms store the typed name, date, time and form version.
- [x] **Row Level Security on every table**: parents see only their family; staff see children only for sessions they're assigned to, and only after two-step sign-in; medical fields can never be read by the public site (tested in `supabase/tests/rls.test.sql`).
- [x] **Two-step sign-in** required for every staff and owner account, enforced in the database as well as the app.
- [x] **Audit log** of register views, booking views, CSV exports, refunds, cancellations, role changes and content changes.
- [x] **Retention**: a daily job deletes medical, allergy and SEND details a set number of months after a child's last camp day (default 12, configurable in Settings).
- [x] **Right of access and erasure**: parents can download their data as JSON and delete it from their account. Payment records are kept without names for tax.
- [x] **Card data never touches our servers** (Stripe Elements and Checkout). Webhooks are verified by signature; payments use idempotency keys.
- [x] **Photos**: children without photo consent can't be tagged in photo posts (checked in the app and by a database trigger). Camp photos are in a private bucket and served through 10-minute signed links. Consent is re-checked each time photos are shown.
- [x] **Data stays in the UK**: Supabase London, Vercel functions in London.
- [x] **No tracking cookies**: only the sign-in cookie and security cookies from Stripe and Turnstile. Vercel Web Analytics is cookie-free, so no cookie banner is needed.
- [x] **Security headers**: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. All secrets are environment variables.
- [x] **Spam and abuse protection**: Turnstile on public forms, database-backed rate limiting, honeypot field.

## Owner to do before launch

- [ ] **Owner**: finalise the privacy policy, cookie policy, terms, booking terms (cancellation and refunds) and safeguarding policy in Admin → Content → Policy pages, then tick Confirmed.
- [ ] **Owner**: confirm the retention period for medical data (Settings) and for booking records.
- [ ] **Owner**: register with the ICO and pay the data protection fee (if not already).
- [ ] **Owner**: sign data processing agreements (they're click-through) with Supabase, Vercel, Stripe and Resend.
- [ ] **Owner**: name a person responsible for data protection and subject access requests.
- [ ] **Owner**: decide whether to import Pebble customers. If yes, check you have a lawful basis to move their data, and import only what's needed.
- [ ] **Owner**: keep `scripts/backup.sh` output encrypted and access-limited.
- [ ] Review staff accounts every term and remove access for anyone who has left (Admin → Staff → Remove access).
