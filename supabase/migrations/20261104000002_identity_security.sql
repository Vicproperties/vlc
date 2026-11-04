-- =============================================================================
-- 0002 Identity & security: admins, permissions, sessions, OTP, rate limits, logs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------------
-- A row here is the ONLY thing that makes an auth user an administrator.
-- There are no client write policies on this table (see 0008); writes happen
-- exclusively in audited server code running with the service role.
create table public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null unique,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  role public.admin_role not null default 'sub_admin',
  is_active boolean not null default true,
  created_by uuid references public.admin_users (id) on delete set null,
  last_login_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_users_updated_at before update on public.admin_users
  for each row execute function private.set_updated_at();

-- Never allow the system to lose its last active super admin (applies to the service role too).
create or replace function private.guard_last_super_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining integer;
begin
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

create trigger admin_users_guard_last_super_admin
  before update or delete on public.admin_users
  for each row execute function private.guard_last_super_admin();

-- Per-module permissions for sub-admins. Super admins have every permission implicitly.
create table public.admin_permissions (
  admin_id uuid not null references public.admin_users (id) on delete cascade,
  module public.admin_module not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_publish boolean not null default false,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (admin_id, module),
  -- Any write capability implies view.
  constraint admin_permissions_view_implied
    check (can_view or not (can_create or can_edit or can_publish or can_delete))
);

create trigger admin_permissions_updated_at before update on public.admin_permissions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin sessions & OTP (private schema: unreachable through the Data API)
-- ---------------------------------------------------------------------------
-- One row per Supabase Auth session (JWT `session_id` claim). Admin access requires
-- otp_verified_at to be set; Stage 4 implements the OTP flow that sets it.
create table private.admin_sessions (
  session_id uuid primary key,
  admin_id uuid not null references public.admin_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  otp_verified_at timestamptz,
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text check (char_length(user_agent) <= 500),
  ip_hash text check (char_length(ip_hash) <= 128)
);
create index admin_sessions_admin_idx on private.admin_sessions (admin_id) where revoked_at is null;

create table private.admin_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_users (id) on delete cascade,
  session_id uuid not null,
  code_hash text not null,
  attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 5,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_otp_session_idx on private.admin_otp_challenges (session_id, created_at desc);

-- Fixed-window rate limiting counters.
create table private.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null
);

-- ---------------------------------------------------------------------------
-- Authorization helpers (used by every RLS policy)
-- ---------------------------------------------------------------------------
-- Idle and absolute limits for admin sessions. Stage 4 touches last_activity_at.
create or replace function private.admin_idle_timeout()
returns interval language sql immutable set search_path = '' as $$ select interval '30 minutes' $$;

-- Active admin with an OTP-verified, unrevoked, unexpired, non-idle session for THIS JWT.
create or replace function private.is_verified_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    join private.admin_sessions s on s.admin_id = a.id
    where a.id = auth.uid()
      and a.is_active
      and s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.otp_verified_at is not null
      and s.revoked_at is null
      and s.expires_at > now()
      and s.last_activity_at > now() - private.admin_idle_timeout()
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_verified_admin()
     and exists (select 1 from public.admin_users where id = auth.uid() and role = 'super_admin');
$$;

create or replace function private.has_admin_permission(p_module public.admin_module, p_action public.admin_action)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_verified_admin() and (
    exists (select 1 from public.admin_users where id = auth.uid() and role = 'super_admin')
    or exists (
      select 1 from public.admin_permissions p
      where p.admin_id = auth.uid()
        and p.module = p_module
        and case p_action
              when 'view' then p.can_view
              when 'create' then p.can_create
              when 'edit' then p.can_edit
              when 'publish' then p.can_publish
              when 'delete' then p.can_delete
            end
    )
  );
$$;

-- Callable by the application to render permission-aware UI. Returns nothing sensitive.
create or replace function public.my_admin_permissions()
returns table (module public.admin_module, can_view boolean, can_create boolean, can_edit boolean,
               can_publish boolean, can_delete boolean, is_super_admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.module,
         private.has_admin_permission(m.module, 'view'),
         private.has_admin_permission(m.module, 'create'),
         private.has_admin_permission(m.module, 'edit'),
         private.has_admin_permission(m.module, 'publish'),
         private.has_admin_permission(m.module, 'delete'),
         private.is_super_admin()
  from unnest(enum_range(null::public.admin_module)) as m(module)
  where private.is_verified_admin();
$$;

-- ---------------------------------------------------------------------------
-- Session management RPCs (service role only — called by Stage 4 server code)
-- ---------------------------------------------------------------------------
create or replace function public.admin_session_create(
  p_session_id uuid, p_admin_id uuid, p_ttl interval, p_user_agent text default null, p_ip_hash text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_sessions (session_id, admin_id, expires_at, user_agent, ip_hash)
  values (p_session_id, p_admin_id, now() + p_ttl, left(p_user_agent, 500), left(p_ip_hash, 128))
  on conflict (session_id) do nothing;
$$;

create or replace function public.admin_session_mark_verified(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.admin_sessions
     set otp_verified_at = now(), last_activity_at = now()
   where session_id = p_session_id and revoked_at is null and expires_at > now();
$$;

create or replace function public.admin_session_touch(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.admin_sessions
     set last_activity_at = now()
   where session_id = p_session_id and revoked_at is null and expires_at > now()
     and last_activity_at > now() - private.admin_idle_timeout();
$$;

-- Revoke one session, or all sessions of an admin when p_session_id is null.
create or replace function public.admin_session_revoke(p_admin_id uuid, p_session_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update private.admin_sessions
     set revoked_at = now()
   where admin_id = p_admin_id
     and revoked_at is null
     and (p_session_id is null or session_id = p_session_id);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (service role only)
-- ---------------------------------------------------------------------------
-- Atomically counts a hit for p_key in a fixed window. Returns true if allowed.
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  insert into private.rate_limits as r (key, window_start, count)
  values (left(p_key, 200), now(), 1)
  on conflict (key) do update
     set count = case when r.window_start <= now() - v_window then 1 else r.count + 1 end,
         window_start = case when r.window_start <= now() - v_window then now() else r.window_start end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Append-only logs
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (actor_type in ('admin', 'customer', 'system')),
  action text not null check (char_length(action) between 3 and 100),
  entity_type text check (char_length(entity_type) <= 60),
  entity_id text check (char_length(entity_id) <= 100),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 16384),
  ip_hash text check (char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index activity_logs_actor_idx on public.activity_logs (actor_id, created_at desc);

create table public.security_events (
  id bigint generated always as identity primary key,
  event_type text not null check (char_length(event_type) between 3 and 100),
  actor_id uuid references auth.users (id) on delete set null,
  email_hash text check (char_length(email_hash) <= 128),
  ip_hash text check (char_length(ip_hash) <= 128),
  user_agent text check (char_length(user_agent) <= 500),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 8192),
  created_at timestamptz not null default now()
);
create index security_events_created_idx on public.security_events (created_at desc);
create index security_events_type_idx on public.security_events (event_type, created_at desc);

-- Logs are immutable for everyone, including the service role and table owner.
-- The only exception: private.purge_expired_logs() may delete rows older than the retention
-- period (activity 2 years, security 1 year). It sets a transaction-local flag checked here.
create or replace function private.prevent_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('app.log_purge', true) = 'on'
     and old.created_at < now() - (case tg_table_name when 'activity_logs' then interval '2 years'
                                                      else interval '1 year' end) then
    return old;
  end if;
  raise exception 'Log records are append-only.' using errcode = 'P0001';
end;
$$;

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
  delete from private.admin_sessions where expires_at < now() - interval '30 days';
  perform set_config('app.log_purge', 'off', true);
end;
$$;

create trigger activity_logs_immutable before update or delete on public.activity_logs
  for each row execute function private.prevent_log_mutation();
create trigger security_events_immutable before update or delete on public.security_events
  for each row execute function private.prevent_log_mutation();

-- Verified admins log their own actions (actor is always the caller, never a parameter).
create or replace function public.log_activity(
  p_action text, p_entity_type text default null, p_entity_id text default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_verified_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.activity_logs (actor_id, actor_type, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin', p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Trusted server code (service role) logs on behalf of a known actor.
create or replace function public.log_activity_as(
  p_actor_id uuid, p_actor_type text, p_action text, p_entity_type text default null,
  p_entity_id text default null, p_metadata jsonb default '{}'::jsonb, p_ip_hash text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (actor_id, actor_type, action, entity_type, entity_id, metadata, ip_hash)
  values (p_actor_id, p_actor_type, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb), p_ip_hash);
$$;

create or replace function public.log_security_event(
  p_event_type text, p_actor_id uuid default null, p_email_hash text default null, p_ip_hash text default null,
  p_user_agent text default null, p_metadata jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.security_events (event_type, actor_id, email_hash, ip_hash, user_agent, metadata)
  values (p_event_type, p_actor_id, p_email_hash, p_ip_hash, left(p_user_agent, 500), coalesce(p_metadata, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text check (char_length(avatar_url) <= 1000),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_profiles_updated_at before update on public.customer_profiles
  for each row execute function private.set_updated_at();

-- Customers sign in with Google only; create their profile automatically.
-- Admin accounts (email provider) never receive a customer profile.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    insert into public.customer_profiles (id, full_name, avatar_url)
    values (
      new.id,
      left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
      left(new.raw_user_meta_data ->> 'avatar_url', 1000)
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();
