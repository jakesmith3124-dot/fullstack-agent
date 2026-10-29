-- Prime Sports UK: complete database setup. Paste all of this into Supabase → SQL Editor → New query, then click Run.
-- Safe to run once on a new project.

-- ===== supabase/migrations/20261029000100_core.sql =====
-- Prime Sports UK: core schema.
-- Every table has Row Level Security switched on. Money is stored in pence.
-- Server code that needs to bypass RLS (webhooks, cron, booking holds) uses the service role key.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Roles and profiles
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'staff', 'parent');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role public.app_role not null default 'parent',
  email citext,
  full_name text,
  phone text,
  emergency_name text,
  emergency_phone text,
  emergency_relationship text,
  stripe_customer_id text unique,
  notification_prefs jsonb not null default
    '{"sign_in":true,"sign_out":true,"updates":true,"late_ack":true,"pickup_reminder":true,"email_fallback":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (email);

-- Owner and staff powers need a second factor (aal2) on the current session.
create or replace function public.session_aal2() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.session_aal2() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.session_aal2() and exists (
    select 1 from public.profiles where id = auth.uid() and role in ('owner', 'staff'))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the owner (or the service role) can change anyone's role.
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id and auth.uid() is not null then
    raise exception 'stripe_customer_id is managed by the server';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_role();

alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_owner());
create policy "own profile update" on public.profiles for update using (id = auth.uid() or public.is_owner());

-- ---------------------------------------------------------------------------
-- Settings and content (the "to confirm" system)
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  confirmed boolean not null default true,
  label text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);
alter table public.settings enable row level security;
-- Settings hold no secrets: flags, discount percentages, instalment rules.
create policy "settings public read" on public.settings for select using (true);
create policy "settings owner write" on public.settings for all using (public.is_owner()) with check (public.is_owner());

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  section text not null,
  kind text not null default 'text' check (kind in ('text', 'faq', 'tile', 'team', 'image', 'list', 'timetable', 'group')),
  data jsonb not null default '{}',
  confirmed boolean not null default false,
  tbc_note text,
  is_visible boolean not null default true,
  sort_order int not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);
create index content_items_section_idx on public.content_items (section, sort_order);
alter table public.content_items enable row level security;
-- The public site only ever sees confirmed, visible items.
create policy "content public read" on public.content_items for select
  using ((confirmed and is_visible) or public.is_owner());
create policy "content owner write" on public.content_items for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Camps and days
-- ---------------------------------------------------------------------------
create table public.camps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand text not null default 'holiday' check (brand in ('holiday', 'prime_camps')),
  school text not null,
  area text not null,
  address text,
  postcode text,
  description text,
  age_min int not null check (age_min between 2 and 18),
  age_max int not null check (age_max between 2 and 18),
  start_time time not null default '09:00',
  end_time time not null default '15:00',
  price_per_day_pence int not null check (price_per_day_pence >= 0),
  full_week_price_pence int check (full_week_price_pence >= 0),
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  photo_path text,
  photo_alt text,
  logo_path text,
  logo_original_path text,
  what_to_bring text,
  timetable jsonb not null default '[]',
  sort_order int not null default 10,
  is_visible boolean not null default true,
  -- Venue, dates and prices confirmed by the owner. Unconfirmed camps never appear publicly.
  confirmed boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_max >= age_min)
);

create table public.camp_days (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps on delete cascade,
  date date not null,
  capacity int not null check (capacity >= 0),
  unique (camp_id, date)
);
create index camp_days_date_idx on public.camp_days (date);

create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles on delete cascade,
  camp_id uuid not null references public.camps on delete cascade,
  camp_day_id uuid references public.camp_days on delete cascade,
  created_at timestamptz not null default now()
);
create unique index staff_assignments_unique on public.staff_assignments (staff_id, camp_id, coalesce(camp_day_id, '00000000-0000-0000-0000-000000000000'));

create or replace function public.is_assigned_to_day(p_day uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or (public.is_staff() and exists (
    select 1 from public.staff_assignments sa
    join public.camp_days d on d.camp_id = sa.camp_id
    where d.id = p_day and sa.staff_id = auth.uid()
      and (sa.camp_day_id is null or sa.camp_day_id = p_day)))
$$;

create or replace function public.is_assigned_to_camp(p_camp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or (public.is_staff() and exists (
    select 1 from public.staff_assignments sa where sa.camp_id = p_camp and sa.staff_id = auth.uid()))
$$;

alter table public.camps enable row level security;
create policy "camps public read" on public.camps for select
  using ((is_visible and confirmed) or public.is_owner() or public.is_assigned_to_camp(id));
create policy "camps owner write" on public.camps for all using (public.is_owner()) with check (public.is_owner());

alter table public.camp_days enable row level security;
create policy "days public read" on public.camp_days for select using (
  exists (select 1 from public.camps c where c.id = camp_id and ((c.is_visible and c.confirmed) or public.is_owner()))
  or public.is_assigned_to_day(id));
create policy "days owner write" on public.camp_days for all using (public.is_owner()) with check (public.is_owner());

alter table public.staff_assignments enable row level security;
create policy "assignments read" on public.staff_assignments for select using (staff_id = auth.uid() or public.is_owner());
create policy "assignments owner write" on public.staff_assignments for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Children
-- ---------------------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles on delete cascade,
  first_name text not null,
  last_name text not null,
  dob date not null,
  school text,
  medical text,
  allergies text,
  send text,
  photo_consent boolean not null default false,
  collectors text[] not null default '{}',
  medical_anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index children_parent_idx on public.children (parent_id);

-- ---------------------------------------------------------------------------
-- Discount codes
-- ---------------------------------------------------------------------------
create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  label text,
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null check (value > 0),
  active boolean not null default false,
  expires_at timestamptz,
  usage_limit int,
  times_used int not null default 0,
  camp_ids uuid[],
  created_at timestamptz not null default now()
);
alter table public.discount_codes enable row level security;
-- Codes are checked on the server with the service role; the public never lists them.
create policy "codes owner" on public.discount_codes for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Bookings, places, instalments, payments
-- ---------------------------------------------------------------------------
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'expired');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  parent_id uuid not null references public.profiles on delete restrict,
  camp_id uuid not null references public.camps on delete restrict,
  status public.booking_status not null default 'pending',
  plan text not null default 'full' check (plan in ('full', 'instalments')),
  instalment_count int not null default 1 check (instalment_count between 1 and 6),
  subtotal_pence int not null,
  sibling_discount_pence int not null default 0,
  code_discount_pence int not null default 0,
  total_pence int not null,
  amount_paid_pence int not null default 0,
  amount_refunded_pence int not null default 0,
  discount_code_id uuid references public.discount_codes on delete set null,
  parent_name text not null,
  parent_email citext not null,
  parent_phone text not null,
  emergency_name text not null,
  emergency_phone text not null,
  emergency_relationship text,
  hold_expires_at timestamptz,
  terms_accepted_at timestamptz,
  stripe_customer_id text,
  stripe_payment_method_id text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  flagged_unpaid boolean not null default false,
  over_capacity boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index bookings_parent_idx on public.bookings (parent_id);
create index bookings_camp_idx on public.bookings (camp_id, status);

create table public.booking_children (
  booking_id uuid not null references public.bookings on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  line_total_pence int not null,
  primary key (booking_id, child_id)
);

create table public.booking_places (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  camp_day_id uuid not null references public.camp_days on delete restrict,
  child_id uuid not null references public.children on delete cascade,
  unique (booking_id, camp_day_id, child_id)
);
create index booking_places_day_idx on public.booking_places (camp_day_id);
create index booking_places_child_idx on public.booking_places (child_id);

create table public.instalments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  seq int not null,
  due_date date not null,
  amount_pence int not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'paid', 'failed', 'cancelled')),
  attempts int not null default 0,
  next_retry_at timestamptz,
  last_error text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  unique (booking_id, seq)
);
create index instalments_due_idx on public.instalments (status, due_date);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings on delete set null,
  instalment_id uuid references public.instalments on delete set null,
  membership_id uuid,
  stripe_payment_intent_id text unique,
  amount_pence int not null,
  refunded_pence int not null default 0,
  status text not null default 'succeeded',
  receipt_url text,
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  payment_id uuid references public.payments on delete set null,
  amount_pence int not null,
  reason text,
  stripe_refund_id text unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- A child is visible to: their parent, the owner, and staff assigned to a day that child is booked on.
create or replace function public.staff_can_see_child(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from public.booking_places bp
    join public.bookings b on b.id = bp.booking_id and b.status = 'confirmed'
    where bp.child_id = p_child and public.is_assigned_to_day(bp.camp_day_id))
$$;

alter table public.children enable row level security;
create policy "children parent read" on public.children for select
  using (parent_id = auth.uid() or public.is_owner() or public.staff_can_see_child(id));
create policy "children parent insert" on public.children for insert with check (parent_id = auth.uid());
create policy "children parent update" on public.children for update using (parent_id = auth.uid() or public.is_owner())
  with check (parent_id = auth.uid() or public.is_owner());
create policy "children parent delete" on public.children for delete using (parent_id = auth.uid() or public.is_owner());

-- Policies call security definer helpers so bookings and booking_places don't recurse into each other.
create or replace function public.owns_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings b where b.id = p_booking and b.parent_id = auth.uid())
$$;

create or replace function public.staff_can_see_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from public.booking_places bp where bp.booking_id = p_booking and public.is_assigned_to_day(bp.camp_day_id))
$$;

alter table public.bookings enable row level security;
create policy "bookings read" on public.bookings for select using (
  parent_id = auth.uid() or public.is_owner() or public.staff_can_see_booking(id));
create policy "bookings owner write" on public.bookings for update using (public.is_owner()) with check (public.is_owner());

alter table public.booking_children enable row level security;
create policy "booking children read" on public.booking_children for select using (
  public.owns_booking(booking_id) or public.is_owner());

alter table public.booking_places enable row level security;
create policy "places read" on public.booking_places for select using (
  public.is_assigned_to_day(camp_day_id) or public.owns_booking(booking_id));

alter table public.instalments enable row level security;
create policy "instalments read" on public.instalments for select using (public.is_owner() or public.owns_booking(booking_id));

alter table public.payments enable row level security;
create policy "payments read" on public.payments for select using (public.is_owner() or public.owns_booking(booking_id));

alter table public.refunds enable row level security;
create policy "refunds read" on public.refunds for select using (public.is_owner() or public.owns_booking(booking_id));

alter table public.stripe_events enable row level security;
-- No policies: service role only.

-- ---------------------------------------------------------------------------
-- Availability and capacity holds
-- ---------------------------------------------------------------------------
-- Places count when the booking is confirmed, or pending with a live hold.
create or replace function public.day_taken(p_day uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.booking_places bp
  join public.bookings b on b.id = bp.booking_id
  where bp.camp_day_id = p_day
    and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > now()))
$$;

create or replace function public.camp_availability(p_camp uuid)
returns table (day_id uuid, date date, capacity int, taken int)
language sql stable security definer set search_path = public as $$
  select d.id, d.date, d.capacity, public.day_taken(d.id)
  from public.camp_days d
  join public.camps c on c.id = d.camp_id
  where d.camp_id = p_camp
    and ((c.is_visible and c.confirmed) or public.is_owner() or auth.role() = 'service_role')
  order by d.date
$$;

-- Creates a pending booking and holds its places, all inside one transaction.
-- Locks each requested day row so two parents can't take the last space at once.
create or replace function public.create_booking_hold(p jsonb)
returns table (booking_id uuid, ref text)
language plpgsql security definer set search_path = public as $$
declare
  v_day uuid;
  v_days uuid[] := array(select jsonb_array_elements_text(p -> 'day_ids')::uuid order by 1);
  v_children uuid[] := array(select jsonb_array_elements_text(p -> 'child_ids')::uuid);
  v_need int := coalesce(array_length(v_children, 1), 0);
  v_cap int;
  v_date date;
  v_booking uuid;
  v_ref text;
  v_hold int := coalesce((select (value)::text::int from public.settings where key = 'hold_minutes'), 15);
begin
  if v_need = 0 or coalesce(array_length(v_days, 1), 0) = 0 then
    raise exception 'NOTHING_TO_BOOK';
  end if;
  -- Lock in a fixed order to avoid deadlocks.
  foreach v_day in array v_days loop
    select capacity, date into v_cap, v_date from public.camp_days
      where id = v_day and camp_id = (p ->> 'camp_id')::uuid for update;
    if not found then raise exception 'UNKNOWN_DAY'; end if;
    if public.day_taken(v_day) + v_need > v_cap then
      raise exception 'DAY_FULL:%', v_date;
    end if;
  end loop;

  loop
    v_ref := 'PS-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
                       from generate_series(1, 6));
    exit when not exists (select 1 from public.bookings b where b.ref = v_ref);
  end loop;

  insert into public.bookings (
    ref, parent_id, camp_id, status, plan, instalment_count,
    subtotal_pence, sibling_discount_pence, code_discount_pence, total_pence, discount_code_id,
    parent_name, parent_email, parent_phone, emergency_name, emergency_phone, emergency_relationship,
    hold_expires_at, terms_accepted_at)
  values (
    v_ref, (p ->> 'parent_id')::uuid, (p ->> 'camp_id')::uuid, 'pending', p ->> 'plan', (p ->> 'instalment_count')::int,
    (p ->> 'subtotal_pence')::int, (p ->> 'sibling_discount_pence')::int, (p ->> 'code_discount_pence')::int,
    (p ->> 'total_pence')::int, nullif(p ->> 'discount_code_id', '')::uuid,
    p ->> 'parent_name', p ->> 'parent_email', p ->> 'parent_phone',
    p ->> 'emergency_name', p ->> 'emergency_phone', p ->> 'emergency_relationship',
    now() + make_interval(mins => v_hold), now())
  returning id into v_booking;

  insert into public.booking_places (booking_id, camp_day_id, child_id)
    select v_booking, d, c from unnest(v_days) d cross join unnest(v_children) c;

  insert into public.booking_children (booking_id, child_id, line_total_pence)
    select v_booking, (x ->> 'child_id')::uuid, (x ->> 'line_total_pence')::int
    from jsonb_array_elements(p -> 'lines') x;

  return query select v_booking, v_ref;
end $$;

revoke execute on function public.create_booking_hold(jsonb) from public, anon, authenticated;

-- Extends a pending hold if every day still has room (used just before payment).
create or replace function public.refresh_booking_hold(p_booking uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_hold int := coalesce((select (value)::text::int from public.settings where key = 'hold_minutes'), 15);
  v_live boolean;
begin
  select (status = 'pending' and hold_expires_at > now()) into v_live from public.bookings where id = p_booking for update;
  if v_live is null then return false; end if;
  if not v_live then
    for r in select bp.camp_day_id, count(*)::int as need from public.booking_places bp
             where bp.booking_id = p_booking group by 1 order by 1 loop
      perform 1 from public.camp_days where id = r.camp_day_id for update;
      if public.day_taken(r.camp_day_id) + r.need > (select capacity from public.camp_days where id = r.camp_day_id) then
        return false;
      end if;
    end loop;
  end if;
  update public.bookings set hold_expires_at = now() + make_interval(mins => v_hold), status = 'pending'
    where id = p_booking and status in ('pending', 'expired');
  return true;
end $$;
revoke execute on function public.refresh_booking_hold(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Waiting lists
-- ---------------------------------------------------------------------------
create table public.waiting_list (
  id uuid primary key default gen_random_uuid(),
  camp_day_id uuid not null references public.camp_days on delete cascade,
  parent_name text not null,
  parent_email citext not null,
  parent_phone text,
  children_count int not null default 1 check (children_count between 1 and 6),
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'removed')),
  offered_at timestamptz,
  user_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.waiting_list enable row level security;
create policy "waiting owner" on public.waiting_list for all using (public.is_owner()) with check (public.is_owner());
create policy "waiting own read" on public.waiting_list for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------
create table public.membership_products (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  tag text,
  ages text,
  blurb text,
  perks text[] not null default '{}',
  flag_key text not null,
  sort_order int not null default 10
);
create table public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.membership_products on delete cascade,
  name text not null,
  price_pence int not null,
  confirmed boolean not null default false,
  sort_order int not null default 10
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles on delete cascade,
  child_id uuid references public.children on delete set null,
  tier_id uuid not null references public.membership_tiers on delete restrict,
  status text not null default 'incomplete',
  paused boolean not null default false,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  last_payment_failed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.membership_products enable row level security;
create policy "products read" on public.membership_products for select using (true);
create policy "products owner" on public.membership_products for all using (public.is_owner()) with check (public.is_owner());
alter table public.membership_tiers enable row level security;
create policy "tiers read" on public.membership_tiers for select using (confirmed or public.is_owner());
create policy "tiers owner" on public.membership_tiers for all using (public.is_owner()) with check (public.is_owner());
alter table public.memberships enable row level security;
create policy "memberships read" on public.memberships for select using (parent_id = auth.uid() or public.is_owner());

-- ---------------------------------------------------------------------------
-- Lead capture
-- ---------------------------------------------------------------------------
create table public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  email citext not null,
  area text not null,
  children_ages text,
  marketing_consent boolean not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.goat_waitlist (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  email citext not null,
  area text not null,
  player_age text,
  consent boolean not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.school_enquiries (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  contact_name text not null,
  role text,
  email citext not null,
  phone text,
  interests text[] not null default '{}',
  message text,
  consent boolean not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null,
  phone text,
  message text not null,
  consent boolean not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.early_access_signups enable row level security;
alter table public.goat_waitlist enable row level security;
alter table public.school_enquiries enable row level security;
alter table public.contact_messages enable row level security;
-- Inserts happen on the server after captcha and rate limiting; only the owner reads.
create policy "ea owner" on public.early_access_signups for select using (public.is_owner());
create policy "goat owner" on public.goat_waitlist for select using (public.is_owner());
create policy "schools owner" on public.school_enquiries for select using (public.is_owner());
create policy "contact owner" on public.contact_messages for select using (public.is_owner());

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);
alter table public.rate_limits enable row level security;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff register and audit log
-- ---------------------------------------------------------------------------
create table public.register_entries (
  id uuid primary key default gen_random_uuid(),
  camp_day_id uuid not null references public.camp_days on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  signed_in_at timestamptz,
  signed_in_by uuid references auth.users on delete set null,
  signed_out_at timestamptz,
  signed_out_by uuid references auth.users on delete set null,
  collected_by text,
  collection_method text check (collection_method in ('qr', 'manual')),
  unique (camp_day_id, child_id)
);
alter table public.register_entries enable row level security;
create policy "register staff" on public.register_entries for all
  using (public.is_assigned_to_day(camp_day_id)) with check (public.is_assigned_to_day(camp_day_id));
create policy "register parent read" on public.register_entries for select using (
  exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users on delete set null,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "audit owner read" on public.audit_log for select using (public.is_owner());

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'))
$$;
grant execute on function public.log_audit(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Retention: anonymise medical details a set time after a child's last booked day.
-- ---------------------------------------------------------------------------
create or replace function public.apply_medical_retention() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_months int := coalesce((select (value)::text::int from public.settings where key = 'retention_months'), 12);
  v_count int;
begin
  with stale as (
    select c.id from public.children c
    where c.medical_anonymised_at is null
      and (c.medical is not null or c.allergies is not null or c.send is not null)
      and coalesce((select max(d.date) from public.booking_places bp
                     join public.camp_days d on d.id = bp.camp_day_id where bp.child_id = c.id),
                   c.created_at::date) < (current_date - make_interval(months => v_months))
  )
  update public.children c set medical = null, allergies = null, send = null, medical_anonymised_at = now()
  from stale where c.id = stale.id;
  get diagnostics v_count = row_count;
  insert into public.audit_log (action, entity, meta) values ('retention_anonymised', 'children', jsonb_build_object('count', v_count));
  return v_count;
end $$;
revoke execute on function public.apply_medical_retention() from public, anon, authenticated;

-- updated_at helpers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger camps_touch before update on public.camps for each row execute function public.touch_updated_at();
create trigger children_touch before update on public.children for each row execute function public.touch_updated_at();

-- ===== supabase/migrations/20261029000200_parent_app.sql =====
-- Prime Camps parent app: live updates, pickup passes, running late, consent forms, web push.

-- Can this parent see this camp day? (They have a confirmed booking on it.)
create or replace function public.parent_has_day(p_day uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.booking_places bp
    join public.bookings b on b.id = bp.booking_id and b.status = 'confirmed'
    where bp.camp_day_id = p_day and b.parent_id = auth.uid())
$$;

create or replace function public.parent_has_camp(p_camp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b where b.camp_id = p_camp and b.status = 'confirmed' and b.parent_id = auth.uid())
$$;

-- Staff posts during the day: notes, notices and photos.
create table public.camp_posts (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps on delete cascade,
  camp_day_id uuid references public.camp_days on delete cascade,
  group_name text,
  kind text not null check (kind in ('photo', 'note', 'notice')),
  title text not null,
  body text,
  photo_paths text[] not null default '{}',
  -- Children who appear in the photos. Every one must have photo consent.
  tagged_child_ids uuid[] not null default '{}',
  author_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index camp_posts_day_idx on public.camp_posts (camp_day_id, created_at desc);
alter table public.camp_posts enable row level security;
create policy "posts staff" on public.camp_posts for all
  using (public.is_assigned_to_camp(camp_id)) with check (public.is_assigned_to_camp(camp_id));
create policy "posts parent read" on public.camp_posts for select using (
  case when camp_day_id is null then public.parent_has_camp(camp_id) else public.parent_has_day(camp_day_id) end);

-- Refuse photo posts that tag a child without photo consent.
create or replace function public.guard_post_consent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if cardinality(new.photo_paths) > 0 and exists (
    select 1 from public.children c where c.id = any(new.tagged_child_ids) and not c.photo_consent) then
    raise exception 'NO_PHOTO_CONSENT';
  end if;
  return new;
end $$;
create trigger camp_posts_consent before insert or update on public.camp_posts
  for each row execute function public.guard_post_consent();

-- One pickup pass per child per camp day. The QR code holds the random token.
create table public.pickup_passes (
  id uuid primary key default gen_random_uuid(),
  camp_day_id uuid not null references public.camp_days on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  token text not null unique,
  code text not null,
  collector_name text,
  updated_at timestamptz not null default now(),
  unique (camp_day_id, child_id)
);
alter table public.pickup_passes enable row level security;
create policy "passes parent" on public.pickup_passes for select using (
  exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));
create policy "passes staff" on public.pickup_passes for select using (public.is_assigned_to_day(camp_day_id));

create table public.late_notices (
  id uuid primary key default gen_random_uuid(),
  camp_day_id uuid not null references public.camp_days on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  parent_id uuid not null references public.profiles on delete cascade,
  eta_minutes int not null check (eta_minutes between 1 and 240),
  message text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.late_notices enable row level security;
create policy "late parent" on public.late_notices for select using (parent_id = auth.uid());
create policy "late staff" on public.late_notices for select using (public.is_assigned_to_day(camp_day_id));

-- Consent forms: each version is kept, signatures record the version signed.
create table public.consent_forms (
  key text not null,
  version int not null,
  title text not null,
  body text not null,
  statements text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (key, version)
);
alter table public.consent_forms enable row level security;
create policy "forms read" on public.consent_forms for select using (true);
create policy "forms owner" on public.consent_forms for all using (public.is_owner()) with check (public.is_owner());

create table public.consent_signatures (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  parent_id uuid not null references public.profiles on delete cascade,
  form_key text not null,
  form_version int not null,
  signed_name text not null check (length(trim(signed_name)) >= 3),
  signed_on date not null,
  signed_at timestamptz not null default now(),
  foreign key (form_key, form_version) references public.consent_forms (key, version)
);
alter table public.consent_signatures enable row level security;
create policy "signatures parent read" on public.consent_signatures for select using (parent_id = auth.uid() or public.is_owner());
create policy "signatures parent insert" on public.consent_signatures for insert with check (
  parent_id = auth.uid() and exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push own" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage. "site" is public (camp photos, logos, page images).
-- "camp-photos" is private: served only through short-lived signed URLs.
-- "originals" keeps untouched uploads for the owner.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('site', 'site', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  ('camp-photos', 'camp-photos', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/heic']),
  ('originals', 'originals', false, 15728640, null)
on conflict (id) do nothing;

drop policy if exists "site public read" on storage.objects;
drop policy if exists "site owner write" on storage.objects;
drop policy if exists "site owner update" on storage.objects;
drop policy if exists "site owner delete" on storage.objects;
drop policy if exists "originals owner" on storage.objects;
create policy "site public read" on storage.objects for select using (bucket_id = 'site');
create policy "site owner write" on storage.objects for insert with check (bucket_id = 'site' and public.is_owner());
create policy "site owner update" on storage.objects for update using (bucket_id = 'site' and public.is_owner());
create policy "site owner delete" on storage.objects for delete using (bucket_id = 'site' and public.is_owner());
create policy "originals owner" on storage.objects for all using (bucket_id = 'originals' and public.is_owner())
  with check (bucket_id = 'originals' and public.is_owner());
-- camp-photos: no client policies. Uploads and signed URLs go through the server after checks.

-- ===== supabase/migrations/20261029000300_profile_email_guard.sql =====
-- Profiles.email mirrors the sign-in email and is used to match guest bookings to accounts,
-- so only the server (service role) may change it, never the signed-in user.
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id and auth.uid() is not null then
    raise exception 'stripe_customer_id is managed by the server';
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'email is managed by the server';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Keep profiles.email in step when someone changes their sign-in email.
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ===== supabase/seed.sql =====
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
