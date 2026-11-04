-- =============================================================================
-- 0007 Bulk imports & first-party analytics
-- =============================================================================

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  kind public.property_kind not null,
  file_name text check (char_length(file_name) <= 255),
  status public.import_status not null default 'validated',
  row_count integer not null default 0 check (row_count >= 0),
  valid_count integer not null default 0 check (valid_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index import_jobs_created_idx on public.import_jobs (created_at desc);

create table public.import_rows (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  row_number integer not null check (row_number >= 1),
  raw jsonb not null check (pg_column_size(raw) <= 65536),
  normalized jsonb,
  errors jsonb not null default '[]'::jsonb,
  duplicate_candidate_id uuid references public.properties (id) on delete set null,
  estate_match_id uuid references public.estates (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  unique (job_id, row_number)
);

-- ---------------------------------------------------------------------------
-- Analytics: anonymous identifiers only. No IP addresses or personal data are stored.
-- Written exclusively by the server (service role) after consent checks.
-- ---------------------------------------------------------------------------
create table public.analytics_sessions (
  id uuid primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  device_type text check (device_type in ('desktop', 'mobile', 'tablet', 'other')),
  browser_family text check (char_length(browser_family) <= 40),
  country text check (char_length(country) <= 2),
  region text check (char_length(region) <= 100),
  city text check (char_length(city) <= 100),
  referrer_host text check (char_length(referrer_host) <= 255),
  source text check (source in ('direct', 'search', 'social', 'referral', 'campaign', 'other')),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  landing_path text check (char_length(landing_path) <= 500),
  current_path text check (char_length(current_path) <= 500),
  current_property_id uuid references public.properties (id) on delete set null
);
create index analytics_sessions_active_idx on public.analytics_sessions (last_seen_at desc);
create index analytics_sessions_started_idx on public.analytics_sessions (started_at);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.analytics_sessions (id) on delete cascade,
  type text not null check (type in (
    'page_view', 'property_view', 'whatsapp_click', 'phone_click', 'enquiry_click',
    'inspection_form_start', 'inspection_form_submit', 'contact_form_submit',
    'newsletter_subscribe', 'favourite_add', 'share_click'
  )),
  path text check (char_length(path) <= 500),
  property_id uuid references public.properties (id) on delete set null,
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events (created_at);
create index analytics_events_type_idx on public.analytics_events (type, created_at);
create index analytics_events_property_idx on public.analytics_events (property_id, created_at) where property_id is not null;

-- Long-term daily rollups (raw events kept ~90 days).
create table public.analytics_daily (
  day date not null,
  metric text not null check (char_length(metric) <= 60),
  dimension text not null default '' check (char_length(dimension) <= 500),
  value bigint not null default 0,
  primary key (day, metric, dimension)
);
