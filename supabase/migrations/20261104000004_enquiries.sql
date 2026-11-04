-- =============================================================================
-- 0004 Enquiries: inspections, contact submissions, favourites, newsletter
-- =============================================================================
-- Public submissions are inserted ONLY by server code (service role) after Zod
-- validation, Turnstile verification and rate limiting. The anon/authenticated roles
-- have no INSERT privilege on these tables, so the Data API cannot be used to bypass
-- those controls.

-- ---------------------------------------------------------------------------
-- Inspection requests
-- ---------------------------------------------------------------------------
create table public.inspection_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete set null,
  property_snapshot jsonb not null default '{}'::jsonb,
  customer_id uuid references auth.users (id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email extensions.citext check (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  preferred_date date,
  preferred_time text check (char_length(preferred_time) <= 40),
  message text check (char_length(message) <= 3000),
  status public.inspection_status not null default 'pending',
  admin_notes text check (char_length(admin_notes) <= 5000),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inspection_requests_status_idx on public.inspection_requests (status, created_at desc);
create index inspection_requests_property_idx on public.inspection_requests (property_id);
create index inspection_requests_customer_idx on public.inspection_requests (customer_id, created_at desc);

-- The property identity is attached by the database from property_id; any client-supplied
-- snapshot, status or admin fields are discarded on insert.
create or replace function private.inspection_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  select id, title, slug, kind, purpose, effective_price, price_period, location_text, status
    into p
  from public.properties
  where id = new.property_id and status in ('published', 'unavailable');

  if not found then
    raise exception 'Property is not available for inspection requests.' using errcode = 'P0001';
  end if;

  new.property_snapshot := jsonb_build_object(
    'id', p.id, 'title', p.title, 'slug', p.slug, 'path', '/properties/' || p.slug,
    'kind', p.kind, 'purpose', p.purpose, 'price', p.effective_price,
    'price_period', p.price_period, 'location', p.location_text, 'status_at_request', p.status
  );
  new.status := 'pending';
  new.admin_notes := null;
  new.handled_by := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger inspection_requests_before_insert before insert on public.inspection_requests
  for each row execute function private.inspection_requests_before_insert();

-- Only status, admin_notes and handled_by may change after submission.
create or replace function private.inspection_requests_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.property_id := old.property_id;
  new.property_snapshot := old.property_snapshot;
  new.customer_id := old.customer_id;
  new.full_name := old.full_name;
  new.phone := old.phone;
  new.email := old.email;
  new.preferred_date := old.preferred_date;
  new.preferred_time := old.preferred_time;
  new.message := old.message;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.handled_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger inspection_requests_before_update before update on public.inspection_requests
  for each row execute function private.inspection_requests_before_update();

create table public.inspection_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.inspection_requests (id) on delete cascade,
  from_status public.inspection_status,
  to_status public.inspection_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index inspection_status_history_request_idx on public.inspection_status_history (request_id, created_at);

create or replace function private.inspection_requests_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.inspection_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, null);
  elsif new.status is distinct from old.status then
    insert into public.inspection_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

create trigger inspection_requests_history after insert or update on public.inspection_requests
  for each row execute function private.inspection_requests_history();

-- Customers see their own requests through this view: no admin notes or staff identities.
create view public.my_inspection_requests
with (security_invoker = false, security_barrier = true)
as
select r.id, r.property_id, r.property_snapshot, r.preferred_date, r.preferred_time,
       r.message, r.status, r.created_at, r.updated_at
from public.inspection_requests r
where r.customer_id = auth.uid();

-- ---------------------------------------------------------------------------
-- Contact submissions
-- ---------------------------------------------------------------------------
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email extensions.citext not null check (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  subject text check (char_length(subject) <= 200),
  message text not null check (char_length(btrim(message)) between 2 and 5000),
  is_read boolean not null default false,
  archived_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index contact_submissions_inbox_idx on public.contact_submissions (archived_at, created_at desc);

-- Only triage fields can change after submission.
create or replace function private.contact_submissions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.name := old.name;
  new.email := old.email;
  new.phone := old.phone;
  new.subject := old.subject;
  new.message := old.message;
  new.created_at := old.created_at;
  new.handled_by := auth.uid();
  return new;
end;
$$;

create trigger contact_submissions_before_update before update on public.contact_submissions
  for each row execute function private.contact_submissions_before_update();

-- ---------------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------------
create table public.favourites (
  customer_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, property_id)
);
create index favourites_property_idx on public.favourites (property_id);

-- ---------------------------------------------------------------------------
-- Newsletter (double opt-in)
-- ---------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status public.newsletter_status not null default 'pending',
  source text check (char_length(source) <= 60),
  consent_text_version text check (char_length(consent_text_version) <= 40),
  confirm_token_hash text unique,
  confirm_token_expires_at timestamptz,
  unsubscribe_token_hash text unique,
  subscribed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status, confirmed_at desc);

create trigger newsletter_subscribers_updated_at before update on public.newsletter_subscribers
  for each row execute function private.set_updated_at();
