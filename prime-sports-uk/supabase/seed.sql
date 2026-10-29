-- Prime Sports UK: base seed. Safe to run on production (idempotent).
-- Wording comes from the approved prototypes. Anything not yet confirmed by the owner
-- is stored with confirmed = false, so the public site hides it until it's confirmed in admin.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, confirmed, label) values
  ('sibling_discount_pct', '10', false, 'Sibling discount (% off each additional child)'),
  ('instalments', '{"enabled":true,"min_days_before":7,"max_count":3,"retry_days":2,"max_attempts":3,"unpaid_flag_days":3}', false, 'Instalment rules'),
  ('hold_minutes', '15', true, 'Minutes a space is held during checkout'),
  ('retention_months', '12', false, 'Months to keep children''s medical details after their last booked day'),
  ('flags', '{"bookings_open":true,"prime_camps_bookings":false,"goat_memberships":false,"holiday_pass":false}', true, 'Feature switches'),
  ('age_groups', '[{"name":"Minis","min":5,"max":7},{"name":"Juniors","min":8,"max":11},{"name":"Seniors","min":12,"max":17}]', false, 'Prime Camps age groups'),
  ('owner_notify_email', '"admin@primesportsuk.org"', true, 'Where form notifications and alerts are sent'),
  ('full_week_pricing', '{"enabled":false}', false, 'Full-week prices (set per camp)'),
  ('tax_free_childcare', '{"accepted":false}', false, 'Tax-Free Childcare and childcare vouchers')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
insert into public.content_items (key, section, kind, data, confirmed, tbc_note, sort_order) values
-- Promo bar (the prototype's version advertised October camps on Pebble, so it starts hidden)
('home.promo', 'home', 'text', '{"text":"October half-term camps in Halifax and Bradford are now open for booking","link_label":"Book now →","href":"/camps"}', false, 'Update the message before showing it', 1),

-- Hero
('home.hero', 'home', 'text', '{"eyebrow":"Children''s sports coaching across Yorkshire","title":"Inspiring children to move, play and grow.","body":"Holiday camps, football development, school PE and community sport across Halifax, Bradford, Calderdale and Kirklees. Sessions that build confidence, friendships and resilience, on and off the field."}', true, null, 2),
('home.badge.qualified', 'home.badges', 'tile', '{"title":"Fully qualified coaches"}', false, 'Confirm coaching qualifications', 1),
('home.badge.dbs', 'home.badges', 'tile', '{"title":"DBS-checked"}', true, null, 2),
('home.badge.inclusive', 'home.badges', 'tile', '{"title":"Inclusive for all abilities"}', true, null, 3),
('home.hero_image', 'images', 'image', '{"label":"Homepage hero photo","alt":"Children playing football at a Prime Sports UK session","path":null}', true, null, 1),
('home.parents_image', 'images', 'image', '{"label":"For parents photo","alt":"Children at a Prime Sports UK holiday camp","path":null}', true, null, 2),
('home.schools_image', 'images', 'image', '{"label":"For schools photo","alt":"A Prime Sports UK coach leading a school PE lesson","path":null}', true, null, 3),
('prime_camps.hero_image', 'images', 'image', '{"label":"Prime Camps hero photo (optional; the logo shows until set)","alt":"Children at Prime Camps","path":null}', true, null, 4),

-- Intro blocks
('home.philosophy', 'home', 'text', '{"eyebrow":"Our philosophy","title":"Putting children first","body":"Every child matters. Our sessions are inclusive, enjoyable and tailored to different ages and abilities. We help children develop sporting skills alongside teamwork, resilience and a lifelong love of being active. We bring the standards of a serious sports organisation, with all the energy and fun children expect."}', true, null, 3),
('home.parents', 'home', 'text', '{"eyebrow":"For parents","title":"Sport, fun and friendships","body":"Fun-packed multi-sports clubs and holiday camps for budding athletes and first-timers alike, in a safe, supportive environment where children leave happy."}', true, null, 4),
('home.schools', 'home', 'text', '{"eyebrow":"For schools","title":"Energy and expertise for your PE","body":"We work with schools and community organisations on PE lessons, breakfast, lunchtime and after-school clubs, enrichment days and funded holiday programmes, including HAF. Every pupil gets the chance to be active, included and inspired."}', true, null, 5),
('home.hwbt', 'home', 'text', '{"eyebrow":"Our values","title":"Hard Work Beats Talent","body":"Effort, attitude and commitment come first. Every child can improve when they show up and give their best."}', true, null, 6),

-- Facts strip
('home.fact.area', 'home.facts', 'tile', '{"title":"Across Yorkshire","body":"Halifax, Bradford, Calderdale, Kirklees and surrounding communities."}', true, null, 1),
('home.fact.week', 'home.facts', 'tile', '{"title":"All week","body":"Times and dates that suit your family."}', true, null, 2),
('home.fact.safe', 'home.facts', 'tile', '{"title":"Happy and safe","body":"Qualified, DBS-checked coaches at every session."}', false, 'Confirm coaching qualifications', 3),

-- Safety & trust
('safety.head', 'safety', 'text', '{"eyebrow":"Safety & trust","title":"Your child is in safe hands","body":"Parents and schools trust us with children every week. This is how we keep them safe."}', true, null, 0),
('safety.dbs', 'safety.tiles', 'tile', '{"icon":"✓","title":"DBS-checked staff","body":"Every coach has an enhanced DBS check before working with children."}', true, null, 1),
('safety.qualified', 'safety.tiles', 'tile', '{"icon":"✓","title":"Qualified coaches","body":"Our coaches hold recognised coaching qualifications in the sports they lead."}', false, 'List qualifications', 2),
('safety.first_aid', 'safety.tiles', 'tile', '{"icon":"+","title":"First aid on site","body":"A qualified first aider is at every session."}', false, 'Confirm first aid cover', 3),
('safety.dsl', 'safety.tiles', 'tile', '{"icon":"◎","title":"Safeguarding lead","body":"A named Designated Safeguarding Lead oversees our policies and training."}', false, 'Add the Designated Safeguarding Lead''s name', 4),
('safety.insured', 'safety.tiles', 'tile', '{"icon":"⌂","title":"Fully insured","body":"Public liability and professional indemnity insurance for all our activities."}', false, 'Confirm insurance cover', 5),
('safety.register', 'safety.tiles', 'tile', '{"icon":"✎","title":"Signed in and out","body":"Children are registered on arrival and only released to adults named on the booking."}', true, null, 6),
('safety.ofsted', 'safety.tiles', 'tile', '{"icon":"★","title":"Ofsted registered","body":"We are registered with Ofsted. Registration number: [ADD NUMBER]."}', false, 'Add Ofsted registration if you hold it', 7),

-- Team
('team.head', 'team', 'text', '{"eyebrow":"Meet the team","title":"The people behind Prime Sports","body":"Trained, qualified coaches running safe, inclusive sessions that build confidence, friendships and life skills."}', false, 'Confirm coaching qualifications', 0),
('team.ben', 'team.members', 'team', '{"name":"Ben Lauder","role":"","initials":"BL","photo":null}', true, 'Photo to come', 1),
('team.jake', 'team.members', 'team', '{"name":"Jake Smith","role":"","initials":"JS","photo":null}', true, 'Photo to come', 2),

-- Parent FAQ (grouped)
('faq.book.how', 'faq.book', 'faq', '{"q":"How do I book?","a":"Choose a camp in the Holiday Camps section, pick your days and add your children. You''ll get a confirmation email straight away."}', true, null, 1),
('faq.book.single', 'faq.book', 'faq', '{"q":"Can I book single days?","a":"Yes. Book one day, a few days or the full week."}', true, null, 2),
('faq.book.sibling', 'faq.book', 'faq', '{"q":"Do you offer sibling discounts?","a":"Yes, a discount is applied automatically when you book more than one child."}', false, 'Discount amount to confirm', 3),
('faq.book.instalments', 'faq.book', 'faq', '{"q":"Can I pay in instalments?","a":"Yes, on camps booked far enough in advance. All payments finish before the camp starts."}', true, null, 4),
('faq.book.tfc', 'faq.book', 'faq', '{"q":"Can I use Tax-Free Childcare or childcare vouchers?","a":"We''re setting this up and will confirm before Prime Camps bookings open."}', false, 'To confirm', 5),
('faq.book.cancel', 'faq.book', 'faq', '{"q":"What if I need to cancel?","a":"Our cancellation and refund policy explains how much notice you need to give and what you''ll get back."}', false, 'Policy to be written', 6),
('faq.day.bring', 'faq.day', 'faq', '{"q":"What should my child bring?","a":"A packed lunch and snacks (nut-free, please), a refillable water bottle, trainers, comfortable sports clothes, a waterproof or sun cream depending on the weather, and any medication clearly labelled with their name."}', true, null, 1),
('faq.day.times', 'faq.day', 'faq', '{"q":"What time is drop-off and collection?","a":"Times are shown on each camp''s booking page. Please arrive on time, as sessions start promptly."}', true, null, 2),
('faq.day.collect', 'faq.day', 'faq', '{"q":"Who can collect my child?","a":"Only adults you''ve named on the booking. If someone else needs to collect, let us know in advance. We won''t release a child to anyone not on the list."}', true, null, 3),
('faq.day.late', 'faq.day', 'faq', '{"q":"What happens if I''m late collecting?","a":"A member of staff will always stay with your child. Please call us as soon as you know you''ll be late."}', false, 'Late collection policy to confirm', 4),
('faq.day.rain', 'faq.day', 'faq', '{"q":"What if it rains?","a":"We have indoor space at our venues and plan wet-weather activities, so camps go ahead whatever the weather."}', false, 'Confirm indoor space at each venue', 5),
('faq.health.dbs', 'faq.health', 'faq', '{"q":"Are your coaches DBS-checked and qualified?","a":"Yes. Every coach working with children has an enhanced DBS check and relevant coaching qualifications."}', false, 'Confirm coaching qualifications', 1),
('faq.health.firstaid', 'faq.health', 'faq', '{"q":"Is there a first aider on site?","a":"Yes, there''s a qualified first aider at every session."}', false, 'Confirm first aid cover', 2),
('faq.health.medical', 'faq.health', 'faq', '{"q":"My child has a medical condition or allergy. Can they attend?","a":"Yes. Tell us when you book, and we''ll make sure staff know and that any medication is kept safe and to hand. For more complex needs we''ll speak to you before the camp."}', true, null, 3),
('faq.health.send', 'faq.health', 'faq', '{"q":"Do you support children with SEND?","a":"We aim to include every child. Tell us about your child''s needs when you book and we''ll talk to you about the right support."}', true, null, 4),
('faq.health.photos', 'faq.health', 'faq', '{"q":"Will photos of my child be shared?","a":"Only if you give permission when you book. You can change your mind at any time."}', true, null, 5),
('faq.more.ages', 'faq.more', 'faq', '{"q":"What ages do you cater for?","a":"Our holiday camps are for ages 4 to 11, and Prime Camps (from February 2027) will run for ages 5 to 17 with separate groups by age."}', true, null, 1),
('faq.more.sporty', 'faq.more', 'faq', '{"q":"My child isn''t very sporty. Will they enjoy it?","a":"Yes. Our sessions are built for all abilities, and lots of children come to try new things and make friends."}', true, null, 2),
('faq.more.schools', 'faq.more', 'faq', '{"q":"Do you work with schools?","a":"Yes. We offer PE support, breakfast, lunchtime and after-school clubs and enrichment. Get in touch to talk about your school."}', true, null, 3),

-- Prime Camps
('pc.group.minis', 'pc.groups', 'group', '{"ages":"5–7","title":"Minis","body":"Fun games, movement skills and confidence building in small, well-supported groups."}', false, 'Group names to confirm', 1),
('pc.group.juniors', 'pc.groups', 'group', '{"ages":"8–11","title":"Juniors","body":"Multi-sports, team challenges and their first taste of proper competition."}', false, 'Group names to confirm', 2),
('pc.group.seniors', 'pc.groups', 'group', '{"ages":"12–17","title":"Seniors","body":"Tournaments, specialist sports, leadership roles and challenges with real stakes."}', false, 'Group names to confirm', 3),
('pc.timetable', 'pc', 'timetable', '{"items":[["8:30","Drop-off and free play","Signed in by name, medical info checked."],["9:15","Warm-up and team split","Children join their age group for the day."],["9:30","Morning sport sessions","Two coached sports with a snack break."],["12:00","Lunch","Packed lunch, supervised by staff."],["12:45","Challenge or specialist sport","Team challenge, archery, fencing and more."],["2:30","Tournament time","The day''s competition, with medals."],["3:30","Cool-down and awards","Star of the day picked by the coaches."],["4:00","Collection","Signed out to an authorised adult only."]]}', false, 'Example day: times to confirm', 1),
('pc.bring', 'pc.info', 'list', '{"title":"What to bring","items":["Packed lunch and snacks (nut-free)","Refillable water bottle","Trainers and sports clothes","Waterproof coat or sun cream","Any medication, clearly labelled"]}', true, null, 1),
('pc.safety', 'pc.info', 'list', '{"title":"Safety","items":["DBS-checked, qualified coaches","First aider on site every day","Signed in and out by name","Medical needs shared with staff"]}', false, 'Confirm safeguarding lead and ratios', 2),
('pc.prices', 'pc.info', 'list', '{"title":"Prices","paragraphs":["Prices are announced when bookings open in January. Early-access families get first pick of spaces and an early-bird offer.","Pay in full or in instalments, with sibling discounts available."]}', true, null, 3),
('pc.faq.where', 'pc.faq', 'faq', '{"q":"Where will camps run?","a":"We''re finalising 3 to 5 venues across West Yorkshire. Sign up for early access and tell us your area so we can plan around demand."}', true, null, 1),
('pc.faq.sporty', 'pc.faq', 'faq', '{"q":"Can my child come if they''re not sporty?","a":"Yes. Camps are built for all abilities. Plenty of children come to try new things and make friends, not to win."}', true, null, 2),
('pc.faq.single', 'pc.faq', 'faq', '{"q":"Can I book single days?","a":"Yes. You can book individual days or the whole week, and add siblings to the same booking."}', true, null, 3),
('pc.faq.instalments', 'pc.faq', 'faq', '{"q":"Can I pay in instalments?","a":"Yes, on camps booked far enough ahead. All instalments finish before the camp starts."}', true, null, 4),
('pc.faq.medical', 'pc.faq', 'faq', '{"q":"My child has medical or additional needs. Can they attend?","a":"Tell us about any medical conditions, allergies or SEND when you book, and we''ll talk to you before the camp about the support they need."}', true, null, 5),
('pc.faq.tfc', 'pc.faq', 'faq', '{"q":"Can I use Tax-Free Childcare or vouchers?","a":"We''re setting this up and will confirm before bookings open."}', false, 'To confirm', 6),

-- G.O.A.T
('goat.info.weekly', 'goat.info', 'tile', '{"title":"Weekly sessions","body":"Regular coached sessions in small groups, organised by age and ability."}', true, 'Days, times and venue to confirm', 1),
('goat.info.membership', 'goat.info', 'tile', '{"title":"Monthly membership","body":"A simple monthly membership you can cancel at any time, with options for one or two sessions a week."}', true, 'Prices to confirm', 2),
('goat.info.trial', 'goat.info', 'tile', '{"title":"Free trial session","body":"Every new player can try a session before joining, so you can see if it''s the right fit."}', true, null, 3),
('goat.details', 'goat', 'text', '{"title":"Session details","body":"Days, times and venue: [TO CONFIRM]. Prices: [TO CONFIRM]."}', false, 'G.O.A.T days, times, venue and prices', 4)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Camps from reference/seed/camps.json (October 2026 half-term, already run).
-- Kept as past camps for testing. Logos are uploaded by `npm run seed:assets`.
-- ---------------------------------------------------------------------------
insert into public.camps (slug, school, area, age_min, age_max, start_time, end_time, price_per_day_pence, confirmed, is_visible, sort_order, what_to_bring)
values
  ('bowling-green-academy-october-2026', 'Bowling Green Academy', 'Halifax', 4, 11, '09:00', '15:00', 2200, true, true, 10,
   'Packed lunch and snacks (nut-free), a refillable water bottle, trainers and sports clothes, a waterproof or sun cream, and any medication clearly labelled.'),
  ('thornton-primary-school-october-2026', 'Thornton Primary School', 'Bradford', 4, 11, '09:00', '15:00', 1500, true, true, 20,
   'Packed lunch and snacks (nut-free), a refillable water bottle, trainers and sports clothes, a waterproof or sun cream, and any medication clearly labelled.')
on conflict (slug) do nothing;

-- Capacity wasn't supplied, so these past camps use a placeholder of 30 places a day.
insert into public.camp_days (camp_id, date, capacity)
select c.id, d::date, 30 from public.camps c,
  unnest(case c.slug
    when 'bowling-green-academy-october-2026' then array['2026-10-27', '2026-10-28', '2026-10-29']
    when 'thornton-primary-school-october-2026' then array['2026-10-26', '2026-10-27', '2026-10-28'] end) d
where c.slug in ('bowling-green-academy-october-2026', 'thornton-primary-school-october-2026')
on conflict (camp_id, date) do nothing;

-- ---------------------------------------------------------------------------
-- Discount codes: EARLYBIRD seeded as an inactive example.
-- ---------------------------------------------------------------------------
insert into public.discount_codes (code, label, kind, value, active)
values ('EARLYBIRD', 'Early-bird 10%', 'percent', 10, false)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Memberships (example tiers; hidden behind feature flags)
-- ---------------------------------------------------------------------------
insert into public.membership_products (key, name, tag, ages, blurb, perks, flag_key, sort_order) values
  ('goat', 'G.O.A.T Football Academy', 'Football development', '5–14', 'Weekly coaching focused on each player''s own progress.',
   array['One coached session every week', 'Player progress updates', 'Cancel any time before your next payment'], 'goat_memberships', 1),
  ('holiday_pass', 'Prime Camps Holiday Pass', 'Holiday camps', '5–17', 'Spread the cost of camps across the year with a monthly pass.',
   array['Monthly camp-day credits to spend at any venue', 'Priority booking before general release', 'Credits roll over for 12 months'], 'holiday_pass', 2)
on conflict (key) do nothing;

insert into public.membership_tiers (product_id, name, price_pence, confirmed, sort_order)
select p.id, t.name, t.price, false, t.sort from public.membership_products p
join (values
  ('goat', '1 session a week', 2500, 1),
  ('goat', '2 sessions a week', 4000, 2),
  ('holiday_pass', '2 days a month', 4200, 1),
  ('holiday_pass', '4 days a month', 8000, 2)) t(product, name, price, sort) on t.product = p.key
where not exists (select 1 from public.membership_tiers x where x.product_id = p.id and x.name = t.name);

-- ---------------------------------------------------------------------------
-- Consent forms (version 1). Wording from the parent app prototype; owner to review.
-- ---------------------------------------------------------------------------
insert into public.consent_forms (key, version, title, body, statements) values
  ('photo_activity', 1, 'Photo & activity consent',
   'Needed before the next camp. It covers photos in the parent feed and taking part in archery and fencing.',
   array['I agree to photos of my child appearing in the private parent feed', 'I agree to my child taking part in specialist sports'])
on conflict (key, version) do nothing;

-- ---------------------------------------------------------------------------
-- Policy pages: DRAFT wording for the owner to review. Hidden publicly until confirmed.
-- ---------------------------------------------------------------------------
insert into public.content_items (key, section, kind, data, confirmed, tbc_note, sort_order) values
('legal.privacy', 'legal', 'text', jsonb_build_object('title', 'Privacy policy', 'updated', '[DATE]', 'body', $$DRAFT: to be reviewed by the owner (and ideally a legal adviser) before publishing.

## Who we are
Prime Sports UK runs children's sports coaching and holiday camps in West Yorkshire. We are the data controller for the personal information described here. Contact: admin@primesportsuk.org.

## What we collect
- Your name, email, mobile number and an emergency contact when you book.
- Your children's names, dates of birth and school, and, only if you choose to tell us, medical conditions, allergies and SEND or support needs.
- The adults allowed to collect your children, and your photo consent choice.
- Sign-in and sign-out times at camp, and who collected your child.
- Payment records. Card details are handled by Stripe and never reach our systems.
- Details you give us in our sign-up and enquiry forms.

## Why we use it
- To run your booking and keep your children safe (contract and legal obligation).
- Medical, allergy and SEND details are special category data. We use them only to care for your child at camp, with your explicit consent, which you can withdraw at any time.
- To email you about camps you've asked to hear about (consent; you can unsubscribe at any time).

## Who sees it
Only our owner and the staff working at the session your child attends. We use these processors: Supabase (database, hosted in London), Vercel (website hosting), Stripe (payments), Resend (email). We never sell or share your data for marketing.

## How long we keep it
Children's medical, allergy and SEND details are deleted [12] months after their last booked camp day. Booking and payment records are kept for [6] years for tax purposes.

## Your rights
You can download or delete your data from your account at any time, or email us. You also have the right to complain to the Information Commissioner's Office (ico.org.uk).$$), false, 'Owner to supply final wording', 1),
('legal.cookies', 'legal', 'text', jsonb_build_object('title', 'Cookie policy', 'updated', '[DATE]', 'body', $$DRAFT: to be reviewed by the owner before publishing.

## Cookies we use
We only use cookies that are strictly necessary for the website to work:
- A sign-in cookie, set when you log in to your account, the admin area or the Prime Camps app.
- Security cookies set by Stripe during payment and by Cloudflare Turnstile on our forms to stop spam.

## Analytics
We use privacy-friendly analytics that don't use cookies and don't track you across other websites, so we don't need to ask for consent.

## Questions
Email admin@primesportsuk.org.$$), false, 'Owner to supply final wording', 2),
('legal.terms', 'legal', 'text', jsonb_build_object('title', 'Terms and conditions', 'updated', '[DATE]', 'body', $$DRAFT: the owner will supply the final terms.

## About these terms
These terms cover your use of the Prime Sports UK website. Booking a camp is also covered by our booking terms.

[OWNER TO SUPPLY]$$), false, 'Owner to supply final wording', 3),
('legal.booking_terms', 'legal', 'text', jsonb_build_object('title', 'Booking terms and cancellation policy', 'updated', '[DATE]', 'body', $$DRAFT: the owner will supply the final booking terms, including the cancellation and refund policy.

## Paying for your booking
You can pay in full, or in monthly instalments on camps booked far enough ahead. By choosing instalments you authorise us to take the remaining payments automatically from the same card on the dates shown at checkout. All instalments finish before the camp starts.

## If a payment fails
We'll email you and try again. If an instalment is still unpaid [3] days before the camp, we'll contact you before your child attends.

## Cancellations and refunds
[OWNER TO SUPPLY: how much notice is needed, and what is refunded.]

## Late collection
[OWNER TO SUPPLY]

## Medical information and collection
Please tell us about any medical conditions, allergies or SEND, and name every adult who may collect your child. We will only release children to adults named on the booking.$$), false, 'Cancellation, refund and late collection policy to confirm', 4),
('legal.safeguarding', 'legal', 'text', jsonb_build_object('title', 'Safeguarding policy', 'updated', '[DATE]', 'body', $$DRAFT: the owner will supply the safeguarding policy.

## Our commitment
The welfare of every child in our care comes first.

## Designated Safeguarding Lead
[NAME AND CONTACT DETAILS TO CONFIRM]

[OWNER TO SUPPLY THE FULL POLICY]$$), false, 'Owner to supply the policy and DSL name', 5)
on conflict (key) do nothing;
