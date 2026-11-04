-- =============================================================================
-- 0010 Last-super-admin guard: maintenance override for direct database sessions
-- =============================================================================
-- The guard still applies to every Data API caller, including the service role used by
-- the application. It can only be bypassed from a direct database connection (no JWT
-- claims present) that explicitly sets `app.allow_admin_purge = 'on'` in its transaction —
-- used by the access-control test suite cleanup and documented emergency maintenance.

create or replace function private.guard_last_super_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining integer;
begin
  if current_setting('app.allow_admin_purge', true) = 'on'
     and nullif(current_setting('request.jwt.claims', true), '') is null then
    return coalesce(new, old);
  end if;

  if (tg_op = 'DELETE' and old.role = 'super_admin' and old.is_active)
     or (tg_op = 'UPDATE' and old.role = 'super_admin' and old.is_active
         and (new.role <> 'super_admin' or not new.is_active)) then
    select count(*) into remaining
    from public.admin_users
    where role = 'super_admin' and is_active and id <> old.id;
    if remaining = 0 then
      raise exception 'The last active super admin cannot be removed, demoted or deactivated.'
        using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
