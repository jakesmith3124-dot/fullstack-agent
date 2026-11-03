-- Prime Sports Darts as a brand alongside Prime Sports UK and Prime Camps.
alter table public.camps drop constraint if exists camps_brand_check;
alter table public.camps add constraint camps_brand_check check (brand in ('holiday', 'prime_camps', 'prime_darts'));
notify pgrst, 'reload schema';
