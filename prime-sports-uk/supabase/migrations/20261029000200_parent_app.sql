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
