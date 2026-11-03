-- Time slots: a date can have several sessions (e.g. darts at 5pm and 6pm), each with its own places.
-- Blank times mean the camp's usual times.
alter table public.camp_days add column if not exists start_time time;
alter table public.camp_days add column if not exists end_time time;
alter table public.camp_days drop constraint if exists camp_days_camp_id_date_key;
create unique index if not exists camp_days_slot_key on public.camp_days (camp_id, date, coalesce(start_time, '00:00'::time));

drop function if exists public.camp_availability(uuid);
create function public.camp_availability(p_camp uuid)
returns table (day_id uuid, date date, capacity int, taken int, start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select d.id, d.date, d.capacity, public.day_taken(d.id), coalesce(d.start_time, c.start_time), coalesce(d.end_time, c.end_time)
  from public.camp_days d
  join public.camps c on c.id = d.camp_id
  where d.camp_id = p_camp
    and ((c.is_visible and c.confirmed) or public.is_owner() or auth.role() = 'service_role')
  order by d.date, coalesce(d.start_time, c.start_time)
$$;
grant execute on function public.camp_availability(uuid) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
