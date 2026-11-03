-- School clubs and darts sessions use the same camps, days and bookings as holiday camps.
-- A club's days are its weekly sessions; parents book single weeks or the whole term
-- (full_week_price_pence is the full-term price for clubs and darts).
alter table public.camps add column if not exists kind text not null default 'camp'
  check (kind in ('camp', 'club', 'darts'));
