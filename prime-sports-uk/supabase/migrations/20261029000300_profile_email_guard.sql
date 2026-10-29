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
