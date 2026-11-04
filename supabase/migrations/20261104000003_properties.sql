-- =============================================================================
-- 0003 Properties: estates, building types, properties, images
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Estates (internal only — never exposed publicly)
-- ---------------------------------------------------------------------------
create table public.estates (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null unique check (char_length(btrim(name::text)) between 2 and 150),
  description text check (char_length(description) <= 5000),
  location text check (char_length(location) <= 300),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger estates_updated_at before update on public.estates
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Building types (admin-extendable reference list; seeded below)
-- ---------------------------------------------------------------------------
create table public.building_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.building_types (name, slug, sort_order) values
  ('Detached Duplex', 'detached-duplex', 10),
  ('Semi-detached Duplex', 'semi-detached-duplex', 20),
  ('Terrace', 'terrace', 30),
  ('Bungalow', 'bungalow', 40),
  ('Flat / Apartment', 'flat-apartment', 50),
  ('Maisonette', 'maisonette', 60),
  ('Penthouse', 'penthouse', 70),
  ('Office', 'office', 80),
  ('Shop', 'shop', 90),
  ('Warehouse', 'warehouse', 100);

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  kind public.property_kind not null,
  purpose public.transaction_purpose,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  description text check (char_length(description) <= 20000),

  -- Location
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 100),
  location_text text check (char_length(location_text) <= 300),
  google_maps_url text check (
    char_length(google_maps_url) <= 2000 and
    google_maps_url ~ '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)'
  ),
  estate_id uuid references public.estates (id) on delete set null,

  -- Common details
  status public.property_status not null default 'draft',
  title_documentation text check (char_length(title_documentation) <= 300),
  features text[] not null default '{}' check (cardinality(features) <= 60),
  youtube_video_id text check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),

  -- Pricing (whole naira). Nothing is invented: every price is optional.
  regular_price numeric(14, 0) check (regular_price > 0),
  sales_price numeric(14, 0) check (sales_price > 0),
  instalment_price numeric(14, 0) check (instalment_price > 0),
  instalment_note text check (char_length(instalment_note) <= 2000),
  price_period public.price_period,
  promotion_active boolean not null default false,
  discount_percent smallint generated always as (
    case
      when promotion_active and regular_price > 0 and sales_price > 0 and sales_price < regular_price
      then nullif(round((regular_price - sales_price) / regular_price * 100), 0)::smallint
    end
  ) stored,
  effective_price numeric(14, 0) generated always as (coalesce(sales_price, regular_price)) stored,

  -- Land-specific
  land_use public.land_use,
  dimensions text check (char_length(dimensions) <= 120),
  available_plots integer check (available_plots >= 0),

  -- Shared size (land plot size, or the land a building sits on)
  land_size numeric(12, 2) check (land_size > 0),
  land_size_unit public.land_size_unit,

  -- Building-specific
  building_type_id uuid references public.building_types (id) on delete set null,
  bedrooms smallint check (bedrooms between 0 and 100),
  bathrooms smallint check (bathrooms between 0 and 100),
  toilets smallint check (toilets between 0 and 100),
  parking_spaces smallint check (parking_spaces between 0 and 500),

  -- Merchandising & SEO
  is_featured boolean not null default false,
  featured_order integer,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  og_image_path text check (char_length(og_image_path) <= 500),

  -- Duplicate review
  duplicate_state public.duplicate_state not null default 'none',
  duplicate_of uuid references public.properties (id) on delete set null,
  duplicate_reviewed_by uuid references auth.users (id) on delete set null,
  duplicate_reviewed_at timestamptz,

  -- Audit
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig,
      coalesce(location_text, '') || ' ' || coalesce(city, '') || ' ' || coalesce(state, '') || ' ' || coalesce(address, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,

  -- Business rules
  constraint properties_price_period_purpose
    check (price_period is null or purpose in ('rent', 'lease')),
  constraint properties_land_size_pair
    check ((land_size is null) = (land_size_unit is null)),
  constraint properties_land_fields_only_for_land
    check (kind = 'land' or (land_use is null and dimensions is null and available_plots is null)),
  constraint properties_building_fields_only_for_buildings
    check (kind = 'building' or (building_type_id is null and bedrooms is null and bathrooms is null
                                 and toilets is null and parking_spaces is null)),
  constraint properties_not_duplicate_of_self check (duplicate_of is null or duplicate_of <> id)
);

create index properties_public_listing_idx on public.properties (status, kind, purpose, effective_price);
create index properties_published_idx on public.properties (status, published_at desc);
create index properties_featured_idx on public.properties (featured_order) where is_featured;
create index properties_estate_idx on public.properties (estate_id);
create index properties_search_idx on public.properties using gin (search_vector);
create index properties_title_trgm_idx on public.properties using gin (lower(title) extensions.gin_trgm_ops);
create index properties_location_trgm_idx on public.properties using gin (lower(location_text) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Property triggers
-- ---------------------------------------------------------------------------

-- Audit columns are owned by the database: clients can never forge them.
create or replace function private.properties_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    -- Duplicate review fields cannot be supplied on insert.
    new.duplicate_state := 'none';
    new.duplicate_of := null;
    new.duplicate_reviewed_by := null;
    new.duplicate_reviewed_at := null;
    new.published_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

-- Generates a unique slug from the title when none is supplied (or on conflict).
-- SECURITY DEFINER so uniqueness checks see all rows regardless of the caller's visibility.
create or replace function private.properties_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;
  base := left(private.slugify(coalesce(nullif(btrim(new.slug), ''), new.title)), 100);
  if base = '' then
    base := 'property';
  end if;
  candidate := base;
  while exists (select 1 from public.properties where slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

-- Duplicate review + publication rules. Runs after audit/slug triggers (alphabetical order).
-- SECURITY DEFINER so duplicate detection sees every property, even when the editing admin
-- lacks properties:view. Permission checks still use the caller's JWT.
create or replace function private.properties_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  trusted boolean := private.is_service_role();
  key_fields_changed boolean;
begin
  -- 1. Duplicate state can only move flagged -> cleared, by someone allowed to publish.
  if tg_op = 'UPDATE' and new.duplicate_state is distinct from old.duplicate_state then
    if old.duplicate_state = 'flagged' and new.duplicate_state = 'cleared'
       and (trusted or private.has_admin_permission('properties', 'publish')) then
      new.duplicate_reviewed_by := auth.uid();
      new.duplicate_reviewed_at := now();
    else
      new.duplicate_state := old.duplicate_state;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.duplicate_of := case when new.duplicate_state = 'none' then null else coalesce(old.duplicate_of, new.duplicate_of) end;
    if new.duplicate_state = old.duplicate_state then
      new.duplicate_reviewed_by := old.duplicate_reviewed_by;
      new.duplicate_reviewed_at := old.duplicate_reviewed_at;
    end if;
  end if;

  -- 2. Detect likely duplicates when identifying fields are new or changed.
  key_fields_changed := tg_op = 'INSERT'
    or new.title is distinct from old.title
    or new.location_text is distinct from old.location_text
    or new.kind is distinct from old.kind
    or new.land_size is distinct from old.land_size
    or new.land_size_unit is distinct from old.land_size_unit;

  if key_fields_changed then
    select p.id into match_id
    from public.properties p
    where p.id <> new.id
      and p.kind = new.kind
      and p.status <> 'archived'
      and extensions.similarity(lower(p.title), lower(new.title)) >= 0.6
      and (p.location_text is null or new.location_text is null
           or extensions.similarity(lower(p.location_text), lower(new.location_text)) >= 0.5)
      and (p.land_size is null or new.land_size is null
           or (p.land_size = new.land_size and p.land_size_unit = new.land_size_unit))
    order by extensions.similarity(lower(p.title), lower(new.title)) desc
    limit 1;

    if match_id is not null and not (tg_op = 'UPDATE' and old.duplicate_state = 'cleared' and old.duplicate_of = match_id) then
      new.duplicate_state := 'flagged';
      new.duplicate_of := match_id;
      new.duplicate_reviewed_by := null;
      new.duplicate_reviewed_at := null;
    elsif match_id is null and new.duplicate_state = 'flagged' then
      new.duplicate_state := 'none';
      new.duplicate_of := null;
    end if;
  end if;

  -- 3. Publishing / unpublishing requires the publish permission, and flagged
  --    duplicates can never be published.
  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status
         and (new.status = 'published' or old.status = 'published')) then
    if not (trusted or private.has_admin_permission('properties', 'publish')) then
      raise exception 'You do not have permission to publish or unpublish properties.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and new.duplicate_state = 'flagged' then
    raise exception 'This property is flagged as a possible duplicate and must be reviewed before publishing.'
      using errcode = 'P0001';
  end if;

  if new.status = 'published' then
    new.published_at := coalesce(case when tg_op = 'UPDATE' then old.published_at end, now());
  elsif tg_op = 'UPDATE' then
    new.published_at := old.published_at;
  end if;

  return new;
end;
$$;

create trigger properties_a_audit before insert or update on public.properties
  for each row execute function private.properties_audit();
create trigger properties_b_slug before insert or update on public.properties
  for each row execute function private.properties_slug();
create trigger properties_c_rules before insert or update on public.properties
  for each row execute function private.properties_rules();

-- Record status changes in the activity log.
create or replace function private.properties_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.activity_logs (actor_id, actor_type, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      case when auth.uid() is null then 'system' else 'admin' end,
      case when tg_op = 'INSERT' then 'property.created' else 'property.status_changed' end,
      'property',
      new.id::text,
      jsonb_build_object('title', new.title, 'from', case when tg_op = 'UPDATE' then old.status end, 'to', new.status)
    );
  end if;
  return null;
end;
$$;

create trigger properties_log_status after insert or update on public.properties
  for each row execute function private.properties_log_status();

-- True if a property is publicly visible (used by policies on child tables).
create or replace function private.is_property_listed(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.properties where id = p_property_id and status in ('published', 'unavailable'));
$$;

-- ---------------------------------------------------------------------------
-- Property images
-- ---------------------------------------------------------------------------
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 500 and storage_path !~ '\.\.'),
  alt_text text check (char_length(alt_text) <= 300),
  width integer check (width > 0),
  height integer check (height > 0),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index property_images_property_idx on public.property_images (property_id, sort_order);
create unique index property_images_one_cover_idx on public.property_images (property_id) where is_cover;

-- ---------------------------------------------------------------------------
-- Public read models
-- ---------------------------------------------------------------------------
-- The base `properties` table is readable only by authorised admins. The public reads
-- these views, which expose only public-safe columns of listed properties. They run with
-- the owner's privileges by design (security_invoker = false); the WHERE clause is the
-- access rule. Internal fields (estate, duplicate review, audit) are never exposed.
create view public.property_listings
with (security_invoker = false, security_barrier = true)
as
select
  p.id, p.kind, p.purpose, p.title, p.slug, p.description,
  p.address, p.city, p.state, p.location_text, p.google_maps_url,
  p.status, p.title_documentation, p.features, p.youtube_video_id,
  p.regular_price, p.sales_price, p.instalment_price, p.instalment_note, p.price_period,
  p.promotion_active, p.discount_percent, p.effective_price,
  p.land_use, p.dimensions, p.available_plots, p.land_size, p.land_size_unit,
  p.building_type_id, bt.name as building_type, bt.slug as building_type_slug,
  p.bedrooms, p.bathrooms, p.toilets, p.parking_spaces,
  p.is_featured, p.featured_order, p.seo_title, p.seo_description, p.og_image_path,
  p.published_at, p.updated_at, p.search_vector,
  (select i.storage_path from public.property_images i
    where i.property_id = p.id order by i.is_cover desc, i.sort_order, i.created_at limit 1) as cover_image_path
from public.properties p
left join public.building_types bt on bt.id = p.building_type_id
where p.status in ('published', 'unavailable');

create view public.property_listing_images
with (security_invoker = false, security_barrier = true)
as
select i.id, i.property_id, i.storage_path, i.alt_text, i.width, i.height, i.sort_order, i.is_cover
from public.property_images i
join public.properties p on p.id = i.property_id
where p.status in ('published', 'unavailable');
