-- Optional badge the owner sets on a camp card, e.g. "Premium" or "New venue".
alter table public.camps add column if not exists badge text check (badge is null or length(badge) <= 24);
notify pgrst, 'reload schema';
