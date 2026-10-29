# Launch checklist (target: mid-January 2027, first Prime Camps in February 2027)

## Accounts and keys
- [ ] Supabase project in London, schema pushed, `seed.sql` run, MFA (TOTP) on, SMTP via Resend, backups on
- [ ] Stripe live keys, webhook endpoint and secret, Apple Pay domain registered
- [ ] Resend domain verified (SPF, DKIM), `EMAIL_FROM` set
- [ ] Turnstile keys, VAPID keys, `CRON_SECRET`, `RATE_LIMIT_SALT`
- [ ] Vercel project with all environment variables; `PAYMENTS_FAKE` empty

## Content (Admin)
- [ ] Work through Dashboard → "Before launch: things to confirm"
- [ ] Upload real photos (hero, parents, schools, team, camp cards) of children with photo consent
- [ ] Policy pages written and confirmed
- [ ] Settings: sibling discount, instalment rules, retention, notification email, feature switches
- [ ] Discount codes (EARLYBIRD is seeded inactive)
- [ ] Prime Camps venues added as camps with days, capacities, prices, logos; confirmed

## People
- [ ] Owner account created (`npm run seed:owner`) and two-step sign-in set up
- [ ] Staff added and assigned to their sessions; each has set up two-step sign-in
- [ ] Staff walk-through of the register on their own phones

## Soft launch
- [ ] Stripe in test mode: book every path on a phone (card, Apple Pay, Google Pay, instalments, discount, siblings)
- [ ] Switch to live keys; book one real camp day yourself and refund it from Admin
- [ ] Soft launch with a few families; check emails arrive and land in inboxes, not spam
- [ ] Domain switch from Wix (README → Domain switch); check the old addresses redirect
- [ ] Submit the sitemap in Google Search Console
- [ ] Turn on "Prime Camps bookings open" in Settings and email the early-access list (CSV export)
