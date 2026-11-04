-- =============================================================================
-- 0001 Foundation: extensions, private schema, enums, shared helper functions
-- =============================================================================
-- Security notes
--   * The `private` schema is NOT exposed through the Supabase Data API. Tables that
--     must never be reachable from a browser (sessions, OTP codes, rate limits) live here.
--   * Every function uses `set search_path = ''` and fully-qualified names to prevent
--     search-path hijacking.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.property_kind as enum ('land', 'building');
create type public.transaction_purpose as enum ('sale', 'rent', 'lease');
create type public.property_status as enum ('draft', 'published', 'unavailable', 'archived');
create type public.duplicate_state as enum ('none', 'flagged', 'cleared');
create type public.land_use as enum ('residential', 'commercial', 'agricultural');
create type public.land_size_unit as enum ('sqm', 'plot', 'acre', 'hectare');
create type public.price_period as enum ('per_week', 'per_month', 'per_year');
create type public.inspection_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.post_status as enum ('draft', 'published');
create type public.admin_role as enum ('super_admin', 'sub_admin');
create type public.admin_module as enum (
  'properties', 'estates', 'inspections', 'enquiries', 'blog', 'content', 'marketing',
  'newsletter', 'customers', 'media', 'settings', 'admins', 'analytics', 'cookies', 'activity_logs'
);
create type public.admin_action as enum ('view', 'create', 'edit', 'publish', 'delete');
create type public.newsletter_status as enum ('pending', 'active', 'unsubscribed');
create type public.banner_type as enum ('information', 'promotion', 'notice');
create type public.announcement_frequency as enum ('once', 'once_per_days', 'once_per_session');
create type public.import_status as enum ('validated', 'imported', 'discarded');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

-- Maintains updated_at.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Convert text to a URL slug (ASCII only; the application also slugifies with accent folding).
create or replace function private.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- True when the current request comes from trusted server code: the service-role key via
-- the Data API, or a direct database session (migrations, maintenance) with no JWT at all.
-- Deliberately does NOT use current_user: inside SECURITY DEFINER functions current_user is
-- the function owner, which would make every caller look trusted.
create or replace function private.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (nullif(current_setting('request.jwt.claims', true), '') is null
          and session_user in ('postgres', 'supabase_admin'));
$$;
