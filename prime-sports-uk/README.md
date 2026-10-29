# Prime Sports UK: website, bookings and Prime Camps app

The production website and booking system for Prime Sports UK, replacing the Wix site and Pebble.

- **Public site**: home, holiday camp finder, camp pages, area pages, Prime Camps, G.O.A.T (coming 2027), schools, safety, FAQ, about, contact and policy pages.
- **Bookings**: pick days with live spaces, add children (with medical, allergy, SEND, collectors and photo consent), pay in full or in instalments, discount codes, sibling discount, waiting lists, confirmation emails.
- **Parent accounts**: bookings, instalment schedules, receipts, children, saved details, memberships (pause or cancel), download or delete my data.
- **Admin** (`/admin`): camps, photos and school logos, content editing with the "to confirm" system, bookings, refunds, reports, waiting lists, discount codes, settings and feature switches, memberships, staff, sign-up lists with CSV export, audit log.
- **Staff register** (`/admin/register`): phone-first register with medical and no-photo flags, sign-in and sign-out, QR pickup passes, running-late alerts, posting photos and notes.
- **Prime Camps parent app** (`/app`): installable web app with Today at camp, Live updates, Pickup pass and Child profile with consent forms. Push notifications with email fallback, and the pickup pass works offline.

## Stack

| Part | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, hosted on Vercel (London region) |
| Database, logins, files | Supabase in London (eu-west-2): Postgres with Row Level Security on every table, email magic links, two-step sign-in (TOTP) for staff and owners, storage buckets |
| Payments | Stripe Payment Element (cards, Apple Pay, Google Pay); Stripe Checkout and Billing for memberships; webhooks as the source of truth |
| Email | Resend with React Email templates |
| Validation | Zod, shared by browser and server |
| Tests | Node test runner (pricing rules), SQL tests (RLS and capacity), Playwright (every booking path and a full camp day) |

Two deliberate choices, explained:

- **Instalments use saved cards and scheduled off-session charges** rather than Stripe subscription schedules. Each instalment is a row in our database tied to the booking, charged by the daily job with an idempotency key, retried on failure, and visible to the owner. That keeps the "final payment at least 7 days before camp" rule exact. Memberships, which are genuinely open-ended, use Stripe Billing subscriptions.
- **Cache Components is switched off** (Next 16's new caching model). Most pages here depend on who is signed in, so the classic model (static public pages refreshed every few minutes, dynamic account pages) is simpler and just as fast. Saving anything in admin refreshes the public pages straight away.

## Run it on your computer

You need Node.js 20.9 or newer and Docker (for the local Supabase).

```bash
npm install
npm run db:start                     # local Supabase: database, logins, storage, test inbox
cp .env.example .env.local           # then paste in the keys that `db:start` printed
npm run seed:assets                  # uploads the two school logos through the logo pipeline
OWNER_EMAIL=you@example.com npm run seed:owner
npm run dev                          # http://localhost:3000
```

- Sign-in emails go to the local test inbox at http://127.0.0.1:54324.
- `supabase/seed-demo.sql` adds two clearly labelled example camps for trying the booking flow locally. It is never run on production.
- With `PAYMENTS_FAKE=1` and no Stripe keys, the payment step shows a test box (with a "simulate a declined card" option) instead of Stripe. It can never switch on in production.

## Tests

```bash
npm test             # pricing, discounts, instalment rules, dates
npm run test:db      # schema, Row Level Security and capacity (needs Postgres server binaries; run as a normal user)
npm run test:e2e     # Playwright: needs `npm run db:start` and .env.local
node --env-file=.env.local --import tsx scripts/capacity-race.mts 60 5   # 60 parents racing for 5 places
npm run lint && npm run typecheck && npm run build
```

The end-to-end tests cover: one child, siblings, instalments, instalments refused when the camp is too soon, discount codes, a full day and its waiting list, age rejection, a declined card, a guest booking appearing in the parent's account, sign-up forms, the instalment-charging job, the "to confirm" rule, and a whole camp day (owner sets up a camp with 2FA, staff sign children in, parent sees it in the app, sends "running late", staff post a consent-checked photo and release the child by pickup pass).

With `STRIPE_SECRET_KEY` and the publishable key set to **test mode** keys, the same booking tests run through real Stripe test payments (except the "declined card" test, which uses the local switch).

## Testing on your phone

1. Deploy a preview (below) or run `npm run dev` and open your computer's address on the same Wi-Fi.
2. Book a camp at `/camps`. With Stripe test keys use card `4242 4242 4242 4242`, any future date and any CVC. Card `4000 0025 0000 3155` tests the bank's extra confirmation step.
3. Sign in at `/login` with the same email to see your booking at `/account`.
4. Open `/app` and use your browser's "Add to Home Screen" to install the Prime Camps app. Tap the bell to allow notifications.
5. As the owner, open `/admin` (you'll set up an authenticator app the first time).

## Deploying

### 1. Supabase (London)

1. Create a project in **London (eu-west-2)**.
2. Link and push the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. In the SQL editor, run `supabase/seed.sql` (safe to re-run). **Do not** run `seed-demo.sql`.
4. Authentication settings:
   - Site URL: `https://www.primesportsuk.org`; redirect URLs: `https://www.primesportsuk.org/**` and your Vercel preview domain.
   - Multi-factor authentication: enable **TOTP** (app authenticator).
   - SMTP: use Resend's SMTP details so sign-in emails come from your domain.
   - Optional: change the magic link template to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account` so links work even if opened on a different device.
5. Turn on **Point-in-time recovery** or daily backups (Pro plan).
6. `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co npm run seed:assets` with production keys, then `npm run seed:owner`.

### 2. Stripe

1. Copy the publishable and secret keys (start in test mode).
2. Add a webhook endpoint `https://www.primesportsuk.org/api/stripe/webhook` with these events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`. Copy its signing secret.
3. Settings → Payment methods: turn on Apple Pay and Google Pay, and register the domain for Apple Pay.
4. Settings → Billing → Subscriptions: turn on smart retries and failed-payment emails.

### 3. Resend, Turnstile, web push

- Resend: add `primesportsuk.org`, add the DNS records it gives you, then set `EMAIL_FROM` (for example `Prime Sports UK <bookings@primesportsuk.org>`).
- Cloudflare Turnstile: create a widget for the domain and copy the site key and secret.
- Web push: `npx web-push generate-vapid-keys` and copy both keys.

### 4. Vercel

1. Import the repository, set the root directory to `prime-sports-uk`, framework Next.js.
2. Add every variable from `.env.example` (production values). Leave `PAYMENTS_FAKE` empty. Set `CRON_SECRET` to a long random string.
3. `vercel.json` pins the functions to London (`lhr1`) and schedules two jobs: 07:05 UTC (expire holds, take due instalments, flag unpaid bookings, data retention) and 16:05 UTC (day-before reminders).
4. Analytics: enable Vercel Web Analytics (no cookies, so no cookie banner is needed).

### 4b. Or host on Render instead of Vercel

`render.yaml` is a Render Blueprint: in Render choose **New → Blueprint**, pick this repository and fill in the values it asks for (the same ones as `.env.example`). It creates the website and the two scheduled jobs. Set `NEXT_PUBLIC_SITE_URL` to the Render address (for example `https://prime-sports-uk.onrender.com`) until the domain moves, and add that address to Supabase's redirect URLs. Render has no London region, so the site runs in Frankfurt while the data stays in London on Supabase. Use a paid instance (Starter or above) so the site doesn't go to sleep.

### 5. Domain switch from Wix

1. In Vercel, add `primesportsuk.org` and `www.primesportsuk.org`.
2. Wherever the domain's DNS is managed, point it at Vercel (the records Vercel shows). Keep the email (MX) records as they are.
3. Old Wix addresses are redirected (301) in `next.config.ts`. Before switching, export the Wix sitemap (`https://www.primesportsuk.org/sitemap.xml`) and add any missing paths to the list.
4. Submit `https://www.primesportsuk.org/sitemap.xml` in Google Search Console.

## Backups

- Supabase takes automatic backups (daily on Pro; point-in-time recovery as an add-on).
- `scripts/backup.sh` makes an extra off-site copy of the database and all uploaded files. Run it weekly and keep the output encrypted: it contains children's data.
- To restore a database dump: `pg_restore --clean --no-owner -d "$SUPABASE_DB_URL" backups/<date>/database.dump`.

## How the "to confirm" rule works

Every claim the owner hasn't confirmed (qualifications, first aid, safeguarding lead, insurance, Ofsted, age group names, the example timetable, sibling discount, Tax-Free Childcare, policies, G.O.A.T details and prices, venues and prices) is stored with `confirmed = false`. Row Level Security means the public site cannot even read those rows. Admin shows them outlined in orange, and the dashboard lists them as "Before launch: things to confirm".

## Project layout

```
src/app/(site)        public pages, booking flow, parent account
src/app/admin         admin area, 2FA, staff register
src/app/app           Prime Camps parent app (PWA)
src/app/api           Stripe webhook, scheduled jobs, app data
src/app/actions       server actions (every one checks who is calling)
src/lib               data access, pricing, payments, email, push, images
src/emails            email templates
supabase/migrations   schema and RLS policies
supabase/seed.sql     settings, content and current camps (production-safe)
supabase/tests        RLS and capacity tests
tests/                unit and Playwright tests
reference/            the brief, approved prototypes, logos and seed data
docs/                 launch and GDPR checklists
```
