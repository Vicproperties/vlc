-- =============================================================================
-- 0014 Admin authentication (Stage 4)
-- =============================================================================
-- Login flow
--   1. Password sign-in (Supabase Auth)            -> server calls admin_session_create()
--   2. Server generates a 6-digit code, stores only its HMAC (bound to the session) via
--      admin_otp_issue(), and emails the code.
--   3. admin_otp_verify() checks the HMAC atomically; 5 wrong codes per login revoke the
--      session (the admin must sign in with the password again).
--   4. Every dashboard request calls admin_session_status() (caller's own JWT), which also
--      records activity for the 30-minute idle timeout.
-- Password recovery
--   Recovery links create a short-lived recovery marker for that Auth session. Only a
--   session carrying a valid marker may set a new password; completing it revokes every
--   admin session of that account.

-- ---------------------------------------------------------------------------
-- Recovery markers (private: unreachable through the Data API)
-- ---------------------------------------------------------------------------
create table private.admin_recovery_sessions (
  session_id uuid primary key,
  admin_id uuid not null references public.admin_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index admin_recovery_sessions_admin_idx on private.admin_recovery_sessions (admin_id);
alter table private.admin_recovery_sessions enable row level security;

-- Total wrong-code attempts allowed per login (across resent codes).
create or replace function private.admin_otp_max_attempts()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

-- Unverified sessions must complete the code step within this time.
create or replace function private.admin_pending_timeout()
returns interval language sql immutable set search_path = '' as $$ select interval '30 minutes' $$;

-- ---------------------------------------------------------------------------
-- OTP issue (service role only)
-- Returns: 'issued' | 'cooldown' | 'limit' | 'invalid_session'
-- ---------------------------------------------------------------------------
create or replace function public.admin_otp_issue(
  p_session_id uuid,
  p_code_hash text,
  p_ttl_seconds integer default 600,
  p_cooldown_seconds integer default 60,
  p_max_per_session integer default 5)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_last timestamptz;
  v_count integer;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid code hash' using errcode = '22023';
  end if;
  if p_ttl_seconds not between 60 and 1800 or p_cooldown_seconds not between 0 and 600
     or p_max_per_session not between 1 and 20 then
    raise exception 'Invalid OTP parameters' using errcode = '22023';
  end if;

  select s.admin_id into v_admin
    from private.admin_sessions s
    join public.admin_users a on a.id = s.admin_id
   where s.session_id = p_session_id
     and a.is_active
     and s.revoked_at is null
     and s.expires_at > now()
     and s.otp_verified_at is null
     and s.created_at > now() - private.admin_pending_timeout()
   for update of s;
  if v_admin is null then
    return 'invalid_session';
  end if;

  select max(created_at), count(*) into v_last, v_count
    from private.admin_otp_challenges where session_id = p_session_id;

  if v_last is not null and v_last > now() - make_interval(secs => p_cooldown_seconds) then
    return 'cooldown';
  end if;
  if v_count >= p_max_per_session then
    return 'limit';
  end if;

  -- Only the newest code is ever valid.
  update private.admin_otp_challenges set consumed_at = now()
   where session_id = p_session_id and consumed_at is null;

  insert into private.admin_otp_challenges (admin_id, session_id, code_hash, max_attempts, expires_at, last_sent_at)
  values (v_admin, p_session_id, p_code_hash, private.admin_otp_max_attempts(),
          now() + make_interval(secs => p_ttl_seconds), now());
  return 'issued';
end;
$$;

-- ---------------------------------------------------------------------------
-- OTP verify (service role only)
-- Returns: 'verified' | 'invalid' | 'expired' | 'locked' | 'no_challenge'
-- ---------------------------------------------------------------------------
create or replace function public.admin_otp_verify(p_session_id uuid, p_code_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_challenge record;
  v_used integer;
begin
  select s.* into v_session
    from private.admin_sessions s
    join public.admin_users a on a.id = s.admin_id
   where s.session_id = p_session_id
     and a.is_active
     and s.revoked_at is null
     and s.expires_at > now()
   for update of s;
  if not found then
    return 'no_challenge';
  end if;
  if v_session.otp_verified_at is not null then
    return 'verified';
  end if;
  if v_session.created_at <= now() - private.admin_pending_timeout() then
    return 'expired';
  end if;

  select coalesce(sum(attempts), 0) into v_used
    from private.admin_otp_challenges where session_id = p_session_id;
  if v_used >= private.admin_otp_max_attempts() then
    update private.admin_sessions set revoked_at = now() where session_id = p_session_id;
    return 'locked';
  end if;

  select * into v_challenge
    from private.admin_otp_challenges
   where session_id = p_session_id and consumed_at is null
   order by created_at desc
   limit 1
   for update;
  if not found then
    return 'no_challenge';
  end if;
  if v_challenge.expires_at <= now() then
    return 'expired';
  end if;

  update private.admin_otp_challenges set attempts = attempts + 1 where id = v_challenge.id;

  if v_challenge.code_hash = p_code_hash then
    update private.admin_otp_challenges set consumed_at = now() where id = v_challenge.id;
    update private.admin_sessions
       set otp_verified_at = now(), last_activity_at = now()
     where session_id = p_session_id;
    return 'verified';
  end if;

  if v_used + 1 >= private.admin_otp_max_attempts() then
    update private.admin_otp_challenges set consumed_at = now() where id = v_challenge.id;
    update private.admin_sessions set revoked_at = now() where session_id = p_session_id;
    return 'locked';
  end if;
  return 'invalid';
end;
$$;

-- ---------------------------------------------------------------------------
-- Session status for the CALLER's own JWT (authenticated). No parameters, so it can
-- never be used to inspect another session. Records activity at most once a minute.
-- Returns: 'none' | 'pending_otp' | 'verified' | 'expired'
-- ---------------------------------------------------------------------------
create or replace function public.admin_session_status()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_session record;
begin
  if auth.uid() is null or v_sid is null then
    return 'none';
  end if;

  select s.* into v_session
    from private.admin_sessions s
    join public.admin_users a on a.id = s.admin_id
   where s.session_id = v_sid
     and s.admin_id = auth.uid()
     and a.is_active;
  if not found then
    return 'none';
  end if;

  if v_session.revoked_at is not null or v_session.expires_at <= now() then
    return 'expired';
  end if;
  if v_session.otp_verified_at is null then
    if v_session.created_at <= now() - private.admin_pending_timeout() then
      return 'expired';
    end if;
    return 'pending_otp';
  end if;
  if v_session.last_activity_at <= now() - private.admin_idle_timeout() then
    return 'expired';
  end if;

  if v_session.last_activity_at < now() - interval '1 minute' then
    update private.admin_sessions set last_activity_at = now() where session_id = v_sid;
  end if;
  return 'verified';
end;
$$;

-- ---------------------------------------------------------------------------
-- Password recovery (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_recovery_start(p_session_id uuid, p_admin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_users where id = p_admin_id and is_active) then
    return false;
  end if;
  insert into private.admin_recovery_sessions (session_id, admin_id, expires_at)
  values (p_session_id, p_admin_id, now() + interval '15 minutes')
  on conflict (session_id) do nothing;
  return true;
end;
$$;

create or replace function public.admin_recovery_is_valid(p_session_id uuid, p_admin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.admin_recovery_sessions r
      join public.admin_users a on a.id = r.admin_id
     where r.session_id = p_session_id
       and r.admin_id = p_admin_id
       and a.is_active
       and r.used_at is null
       and r.expires_at > now()
  );
$$;

-- Marks the recovery used and revokes every admin session of the account.
create or replace function public.admin_recovery_complete(p_session_id uuid, p_admin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.admin_recovery_sessions
     set used_at = now()
   where session_id = p_session_id and admin_id = p_admin_id
     and used_at is null and expires_at > now();
  if not found then
    return false;
  end if;
  update private.admin_sessions set revoked_at = now()
   where admin_id = p_admin_id and revoked_at is null;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention: include recovery markers in the purge
-- ---------------------------------------------------------------------------
create or replace function private.purge_expired_logs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.log_purge', 'on', true);
  delete from public.activity_logs where created_at < now() - interval '2 years';
  delete from public.security_events where created_at < now() - interval '1 year';
  delete from private.rate_limits where window_start < now() - interval '1 day';
  delete from private.admin_otp_challenges where created_at < now() - interval '1 day';
  delete from private.admin_recovery_sessions where created_at < now() - interval '1 day';
  delete from private.admin_sessions where expires_at < now() - interval '30 days';
  perform set_config('app.log_purge', 'off', true);
end;
$$;
revoke execute on function private.purge_expired_logs() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function
  public.admin_otp_issue(uuid, text, integer, integer, integer),
  public.admin_otp_verify(uuid, text),
  public.admin_session_status(),
  public.admin_recovery_start(uuid, uuid),
  public.admin_recovery_is_valid(uuid, uuid),
  public.admin_recovery_complete(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.admin_otp_issue(uuid, text, integer, integer, integer),
  public.admin_otp_verify(uuid, text),
  public.admin_session_status(),
  public.admin_recovery_start(uuid, uuid),
  public.admin_recovery_is_valid(uuid, uuid),
  public.admin_recovery_complete(uuid, uuid)
to service_role;

grant execute on function public.admin_session_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled retention purge (daily 03:17 UTC)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-logs';
  perform cron.schedule('purge-expired-logs', '17 3 * * *', 'select private.purge_expired_logs()');
end;
$$;
