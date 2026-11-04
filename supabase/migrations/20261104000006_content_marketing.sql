-- =============================================================================
-- 0006 Website content & marketing
-- =============================================================================
-- No company content is seeded: every value is entered by the owner in the dashboard.

-- Singleton row of company-wide settings (id is always 1).
create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text check (char_length(company_name) <= 150),
  tagline text check (char_length(tagline) <= 200),
  phone_primary text check (phone_primary ~ '^\+[1-9][0-9]{6,14}$'),
  phone_secondary text check (phone_secondary ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp_number text check (whatsapp_number ~ '^\+[1-9][0-9]{6,14}$'),
  email_primary extensions.citext check (char_length(email_primary::text) <= 254),
  address text check (char_length(address) <= 400),
  map_embed_url text check (map_embed_url ~ '^https://(www\.)?google\.[a-z.]+/maps/embed'),
  business_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(business_hours) = 'array'),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  default_seo_title text check (char_length(default_seo_title) <= 120),
  default_seo_description text check (char_length(default_seo_description) <= 320),
  default_og_image_path text check (char_length(default_og_image_path) <= 500),
  ga_measurement_id text check (ga_measurement_id ~ '^G-[A-Z0-9]{4,20}$'),
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1);

-- Typed content blocks per page section. The application validates `content` with a
-- Zod schema per (page_key, section_key) before writing.
create table public.page_sections (
  page_key text not null check (page_key in ('home', 'about', 'contact', 'blog')),
  section_key text not null check (section_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000),
  is_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (page_key, section_key)
);

create table public.core_values (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 1000),
  icon_key text check (icon_key ~ '^[a-z0-9-]{1,40}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.why_choose_us_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (char_length(description) <= 1000),
  icon_key text check (icon_key ~ '^[a-z0-9-]{1,40}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  position text check (char_length(position) <= 120),
  department text check (char_length(department) <= 120),
  bio text check (char_length(bio) <= 3000),
  photo_path text check (char_length(photo_path) <= 500),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(btrim(question)) between 5 and 300),
  answer text not null check (char_length(btrim(answer)) between 2 and 5000),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.legal_pages (
  slug text primary key check (slug in ('privacy-policy', 'terms-and-conditions')),
  title text not null check (char_length(btrim(title)) between 3 and 150),
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text,
  version integer not null default 1 check (version >= 1),
  is_published boolean not null default false,
  needs_legal_review boolean not null default true,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Announcement modal (multiple, prioritised, scheduled, frequency-capped).
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  heading text not null check (char_length(btrim(heading)) between 2 and 150),
  message text check (char_length(message) <= 2000),
  image_path text check (char_length(image_path) <= 500),
  image_alt text check (char_length(image_alt) <= 300),
  cta_label text check (char_length(cta_label) <= 40),
  cta_url text check (cta_url ~ '^(/[^/\\]|https://)' and char_length(cta_url) <= 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  frequency public.announcement_frequency not null default 'once_per_days',
  frequency_days smallint check (frequency_days between 1 and 365),
  version integer not null default 1,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint announcements_schedule check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint announcements_cta_pair check ((cta_label is null) = (cta_url is null)),
  constraint announcements_frequency_days check (frequency <> 'once_per_days' or frequency_days is not null)
);
create index announcements_active_idx on public.announcements (priority desc) where is_active;

create table public.top_banners (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(btrim(message)) between 2 and 200),
  type public.banner_type not null default 'information',
  link_url text check (link_url ~ '^(/[^/\\]|https://)' and char_length(link_url) <= 1000),
  cta_label text check (char_length(cta_label) <= 40),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint top_banners_schedule check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Cookie notice configuration (singleton) and anonymous consent records for statistics.
create table public.cookie_settings (
  id smallint primary key default 1 check (id = 1),
  notice_text text check (char_length(notice_text) <= 2000),
  analytics_description text check (char_length(analytics_description) <= 1000),
  marketing_description text check (char_length(marketing_description) <= 1000),
  policy_version text not null default '1' check (char_length(policy_version) <= 20),
  enable_first_party_analytics boolean not null default true,
  enable_google_analytics boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.cookie_settings (id) values (1);

create table public.cookie_consents (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  analytics boolean not null,
  marketing boolean not null,
  policy_version text not null check (char_length(policy_version) <= 20),
  created_at timestamptz not null default now()
);
create index cookie_consents_created_idx on public.cookie_consents (created_at desc);

-- Media library registry (files live in Supabase Storage).
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('property-media', 'blog-media', 'site-media')),
  path text not null check (char_length(path) <= 500 and path !~ '\.\.'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  width integer check (width > 0),
  height integer check (height > 0),
  alt_text text check (char_length(alt_text) <= 300),
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- updated_at maintenance
create trigger site_settings_updated_at before update on public.site_settings for each row execute function private.set_updated_at();
create trigger page_sections_updated_at before update on public.page_sections for each row execute function private.set_updated_at();
create trigger core_values_updated_at before update on public.core_values for each row execute function private.set_updated_at();
create trigger why_choose_us_items_updated_at before update on public.why_choose_us_items for each row execute function private.set_updated_at();
create trigger team_members_updated_at before update on public.team_members for each row execute function private.set_updated_at();
create trigger faqs_updated_at before update on public.faqs for each row execute function private.set_updated_at();
create trigger legal_pages_updated_at before update on public.legal_pages for each row execute function private.set_updated_at();
create trigger announcements_updated_at before update on public.announcements for each row execute function private.set_updated_at();
create trigger top_banners_updated_at before update on public.top_banners for each row execute function private.set_updated_at();
create trigger cookie_settings_updated_at before update on public.cookie_settings for each row execute function private.set_updated_at();

-- Bump the announcement version when its content changes so visitors see the new version.
create or replace function private.announcements_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.heading, new.message, new.image_path, new.cta_label, new.cta_url)
     is distinct from row(old.heading, old.message, old.image_path, old.cta_label, old.cta_url) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;
create trigger announcements_bump_version before update on public.announcements
  for each row execute function private.announcements_bump_version();
