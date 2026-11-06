-- Customers now register with email and password (owner, 2026-11-06); Google sign-in is removed.
--
-- The old trigger created a customer profile for every new Google identity. Customer accounts
-- are now created only by the website's registration action (server side, after the bot check
-- and rate limits), which also creates the profile. Accounts created any other way, including
-- staff accounts, never receive a customer profile, so they cannot use customer features.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists private.handle_new_auth_user();

-- Server-only lookup used by registration, "resend activation link" and "forgot password".
-- Never callable by visitors (it would reveal which emails have accounts).
create or replace function public.customer_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

revoke execute on function public.customer_id_for_email(text) from public, anon, authenticated;
grant execute on function public.customer_id_for_email(text) to service_role;
