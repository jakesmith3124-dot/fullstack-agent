-- LOCAL DEVELOPMENT ONLY: example upcoming camps so the booking flow can be tried end to end.
-- Never run this on production. Every row is flagged is_demo and labelled "Example".
insert into public.camps (slug, school, area, address, postcode, age_min, age_max, start_time, end_time, price_per_day_pence, confirmed, is_visible, is_demo, sort_order, what_to_bring, description)
values
  ('example-bowling-green-february-2027', 'Bowling Green Academy', 'Halifax', '[Example address]', 'HX0 0XX', 4, 11, '09:00', '15:00', 2200, true, true, true, 1,
   'Packed lunch and snacks (nut-free), a refillable water bottle, trainers and sports clothes, a waterproof or sun cream, and any medication clearly labelled.',
   'Example February half-term camp for testing the booking flow.'),
  ('example-thornton-christmas-2026', 'Thornton Primary School', 'Bradford', '[Example address]', 'BD0 0XX', 4, 11, '09:00', '15:00', 1500, true, true, true, 2,
   'Packed lunch and snacks (nut-free), a refillable water bottle and warm sports clothes.',
   'Example Christmas holiday camp for testing the booking flow.')
on conflict (slug) do nothing;

insert into public.camp_days (camp_id, date, capacity)
select c.id, d.date::date, d.cap from public.camps c
join (values
  ('example-bowling-green-february-2027', '2027-02-15', 30),
  ('example-bowling-green-february-2027', '2027-02-16', 30),
  ('example-bowling-green-february-2027', '2027-02-17', 30),
  ('example-bowling-green-february-2027', '2027-02-18', 0),
  ('example-bowling-green-february-2027', '2027-02-19', 6),
  ('example-thornton-christmas-2026', '2026-12-21', 24),
  ('example-thornton-christmas-2026', '2026-12-22', 24),
  ('example-thornton-christmas-2026', '2026-12-23', 24)) d(slug, date, cap) on d.slug = c.slug
on conflict (camp_id, date) do nothing;

-- A working example discount code for local testing.
insert into public.discount_codes (code, label, kind, value, active) values ('TEST5', 'Test £5 off', 'fixed', 500, true)
on conflict (code) do nothing;

-- Show the sibling discount locally so it can be tested (still unconfirmed on production).
update public.settings set confirmed = true where key = 'sibling_discount_pct';
