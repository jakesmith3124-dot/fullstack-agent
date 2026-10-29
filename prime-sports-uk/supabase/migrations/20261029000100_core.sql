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
