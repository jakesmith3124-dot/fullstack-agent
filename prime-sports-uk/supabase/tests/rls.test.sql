-- Row Level Security and booking-capacity tests. Run with: npm run test:db
-- Each check raises an exception on failure, which stops psql with a non-zero exit.

create or replace function pg_temp.act_as(p_sub uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_sub is null then '{"role":"anon"}'
    else json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', p_aal)::text end, false);
end $$;

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Fixtures (as superuser) -----------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'parent1@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'parent2@example.com');
update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-0000000000b1';

insert into public.camps (id, slug, school, area, age_min, age_max, price_per_day_pence, confirmed)
values ('10000000-0000-0000-0000-000000000001', 'test-camp-a', 'Test School A', 'Halifax', 4, 11, 2000, true),
       ('10000000-0000-0000-0000-000000000002', 'test-camp-b', 'Test School B', 'Bradford', 4, 11, 2000, true),
       ('10000000-0000-0000-0000-000000000003', 'hidden-camp', 'Hidden School', 'Leeds', 4, 11, 2000, false);
insert into public.camp_days (id, camp_id, date, capacity) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2027-02-15', 2),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2027-02-15', 10);
insert into public.staff_assignments (staff_id, camp_id) values
  ('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001');

insert into public.children (id, parent_id, first_name, last_name, dob, medical, photo_consent) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Lily', 'H', '2019-05-01', 'Nut allergy', false),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 'Sam', 'K', '2017-03-01', null, true),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c2', 'Ava', 'K', '2018-03-01', null, true);

-- Holds (service role path) ----------------------------------------------------
select pg_temp.check((select count(*) = 1 from public.create_booking_hold(jsonb_build_object(
  'camp_id', '10000000-0000-0000-0000-000000000001', 'parent_id', '00000000-0000-0000-0000-0000000000c1',
  'day_ids', jsonb_build_array('20000000-0000-0000-0000-000000000001'),
  'child_ids', jsonb_build_array('30000000-0000-0000-0000-000000000001'),
  'lines', jsonb_build_array(jsonb_build_object('child_id', '30000000-0000-0000-0000-000000000001', 'line_total_pence', 2000)),
  'plan', 'full', 'instalment_count', 1, 'subtotal_pence', 2000, 'sibling_discount_pence', 0, 'code_discount_pence', 0,
  'total_pence', 2000, 'parent_name', 'P One', 'parent_email', 'parent1@example.com', 'parent_phone', '07700900123',
  'emergency_name', 'E', 'emergency_phone', '07700900000'))), 'first hold is created');

do $$ begin
  perform public.create_booking_hold(jsonb_build_object(
    'camp_id', '10000000-0000-0000-0000-000000000001', 'parent_id', '00000000-0000-0000-0000-0000000000c2',
    'day_ids', jsonb_build_array('20000000-0000-0000-0000-000000000001'),
    'child_ids', jsonb_build_array('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'),
    'lines', '[]'::jsonb, 'plan', 'full', 'instalment_count', 1, 'subtotal_pence', 4000, 'sibling_discount_pence', 0,
    'code_discount_pence', 0, 'total_pence', 4000, 'parent_name', 'P Two', 'parent_email', 'parent2@example.com',
    'parent_phone', '07700900456', 'emergency_name', 'E', 'emergency_phone', '07700900000'));
  raise exception 'FAILED: two children fitted into one remaining space';
exception when others then
  if sqlerrm not like 'DAY_FULL:%' then raise; end if;
  raise notice 'ok - capacity is enforced (2 children, 1 space left)';
end $$;

-- An expired hold frees its space.
update public.bookings set hold_expires_at = now() - interval '1 minute' where parent_id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check(public.day_taken('20000000-0000-0000-0000-000000000001') = 0, 'expired holds do not count against capacity');
update public.bookings set status = 'confirmed', hold_expires_at = null where parent_id = '00000000-0000-0000-0000-0000000000c1';
-- Sam booked on camp B (not assigned to the staff member).
insert into public.bookings (id, ref, parent_id, camp_id, status, subtotal_pence, total_pence, parent_name, parent_email, parent_phone, emergency_name, emergency_phone)
values ('40000000-0000-0000-0000-000000000002', 'PS-TEST02', '00000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-000000000002', 'confirmed', 2000, 2000, 'P Two', 'parent2@example.com', '0', 'E', '0');
insert into public.booking_places (booking_id, camp_day_id, child_id) values
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002');

insert into public.early_access_signups (first_name, email, area, marketing_consent) values ('Test', 'lead@example.com', 'Halifax', true);

-- Anonymous visitor -------------------------------------------------------------
set role anon;
select pg_temp.act_as(null);
select pg_temp.check((select count(*) from public.children) = 0, 'anon sees no children');
select pg_temp.check((select count(*) from public.bookings) = 0, 'anon sees no bookings');
select pg_temp.check((select count(*) from public.early_access_signups) = 0, 'anon cannot read leads');
select pg_temp.check((select count(*) from public.discount_codes) = 0, 'anon cannot list discount codes');
select pg_temp.check(not exists (select 1 from public.content_items where not confirmed), 'anon sees no unconfirmed content');
select pg_temp.check(exists (select 1 from public.content_items where key = 'home.hero'), 'anon sees confirmed content');
select pg_temp.check(not exists (select 1 from public.camps where slug = 'hidden-camp'), 'anon cannot see unconfirmed camps');
select pg_temp.check((select count(*) from public.camp_availability('10000000-0000-0000-0000-000000000001')) = 1, 'anon can read availability');
do $$ begin
  perform public.create_booking_hold('{}'::jsonb);
  raise exception 'FAILED: anon could call create_booking_hold';
exception when insufficient_privilege then raise notice 'ok - anon cannot create holds directly';
end $$;
reset role;

-- Parent ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from public.children) = 1, 'parent 1 sees only their own child');
select pg_temp.check((select count(*) from public.bookings) = 1, 'parent 1 sees only their own booking');
select pg_temp.check((select count(*) from public.profiles) = 1, 'parent sees only their own profile');
do $$ begin
  update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'FAILED: parent promoted themselves';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - parent cannot change their own role';
end $$;
do $$ begin
  update public.profiles set email = 'parent2@example.com' where id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'FAILED: parent changed their profile email';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - parent cannot change the email used to match bookings';
end $$;
do $$ begin
  insert into public.children (parent_id, first_name, last_name, dob) values ('00000000-0000-0000-0000-0000000000c2', 'X', 'Y', '2018-01-01');
  raise exception 'FAILED: parent added a child to another family';
exception when insufficient_privilege then raise notice 'ok - parent cannot add a child to another family';
end $$;
select pg_temp.check((select count(*) from public.early_access_signups) = 0, 'parent cannot read leads');
reset role;

-- Staff ----------------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1', 'aal1');
select pg_temp.check((select count(*) from public.children) = 0, 'staff without 2FA sees no children');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1', 'aal2');
select pg_temp.check((select count(*) from public.children) = 1, 'staff with 2FA sees only children on assigned sessions');
select pg_temp.check((select first_name from public.children) = 'Lily', 'staff sees the right child');
select pg_temp.check(not exists (select 1 from public.children where id = '30000000-0000-0000-0000-000000000002'), 'staff cannot see a child at an unassigned camp');
insert into public.register_entries (camp_day_id, child_id, signed_in_at) values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now());
select pg_temp.check(true, 'staff can sign a child in on an assigned day');
do $$ begin
  insert into public.register_entries (camp_day_id, child_id, signed_in_at) values
    ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', now());
  raise exception 'FAILED: staff signed in a child at an unassigned camp';
exception when insufficient_privilege then raise notice 'ok - staff cannot use registers for unassigned camps';
end $$;
select pg_temp.check((select count(*) from public.early_access_signups) = 0, 'staff cannot read leads');
do $$ begin
  insert into public.camp_posts (camp_id, kind, title, photo_paths, tagged_child_ids) values
    ('10000000-0000-0000-0000-000000000001', 'photo', 'Archery', array['x.jpg'], array['30000000-0000-0000-0000-000000000001'::uuid]);
  raise exception 'FAILED: posted a photo of a child without consent';
exception when raise_exception then
  if sqlerrm <> 'NO_PHOTO_CONSENT' then raise; end if;
  raise notice 'ok - photos of children without consent are refused';
end $$;
reset role;

-- Parent can see their child's register status; other parent cannot.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from public.register_entries) = 1, 'parent sees their child''s sign-in');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from public.register_entries) = 0, 'other parents do not');
reset role;

-- Owner ----------------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select pg_temp.check((select count(*) from public.early_access_signups) = 0, 'owner without 2FA cannot read leads');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select pg_temp.check((select count(*) from public.early_access_signups) = 1, 'owner with 2FA reads leads');
select pg_temp.check((select count(*) from public.children) = 3, 'owner sees all children');
select pg_temp.check(exists (select 1 from public.content_items where not confirmed), 'owner sees unconfirmed content');
select pg_temp.check(exists (select 1 from public.camps where slug = 'hidden-camp'), 'owner sees unconfirmed camps');
reset role;

-- Retention ------------------------------------------------------------------------
update public.camp_days set date = current_date - interval '13 months' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check(public.apply_medical_retention() >= 1, 'retention job anonymises stale medical data');
select pg_temp.check((select medical is null from public.children where id = '30000000-0000-0000-0000-000000000001'), 'medical field cleared');
