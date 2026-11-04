-- =============================================================================
-- 0015 Property management (Stage 5)
-- =============================================================================
-- Owner decisions (2026-11-04):
--   * State is chosen from Nigeria's 36 states + the Federal Capital Territory.
--   * Descriptions are simple formatted text: the application stores sanitised HTML in
--     description_html and its plain-text form in description (used by search).
--   * Photos are re-encoded to WebP without metadata before storage (application side).

-- ---------------------------------------------------------------------------
-- Nigerian states
-- ---------------------------------------------------------------------------
create or replace function private.nigerian_states()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory',
    'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
    'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara'
  ]::text[]
$$;

-- No real listings exist yet (development data is test-only); clear anything non-standard.
update public.properties set state = null where state is not null and not (state = any (private.nigerian_states()));

alter table public.properties
  add constraint properties_state_nigeria check (state is null or state = any (private.nigerian_states()));

-- ---------------------------------------------------------------------------
-- Formatted descriptions
-- ---------------------------------------------------------------------------
alter table public.properties
  add column description_html text check (char_length(description_html) <= 100000);

-- Public read model gains the formatted description (sanitised by the application before
-- storage; reviewed for public safety per ADR-001).
create or replace view public.property_listings
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
    where i.property_id = p.id order by i.is_cover desc, i.sort_order, i.created_at limit 1) as cover_image_path,
  p.description_html
from public.properties p
left join public.building_types bt on bt.id = p.building_type_id
where p.status in ('published', 'unavailable');

grant select on public.property_listings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Images: at most 30 per property; cover and order changes are atomic
-- ---------------------------------------------------------------------------
create or replace function private.property_images_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.properties where id = new.property_id for update;
  if (select count(*) from public.property_images where property_id = new.property_id) >= 30 then
    raise exception 'A property can have at most 30 photos.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger property_images_limit before insert on public.property_images
  for each row execute function private.property_images_limit();

-- Runs with the caller's privileges: RLS (properties:edit) applies to every update.
create or replace function public.set_property_cover(p_property_id uuid, p_image_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.property_images where id = p_image_id and property_id = p_property_id) then
    raise exception 'Photo not found.' using errcode = 'P0002';
  end if;
  update public.property_images set is_cover = false where property_id = p_property_id and is_cover and id <> p_image_id;
  update public.property_images set is_cover = true where id = p_image_id;
end;
$$;

create or replace function public.reorder_property_images(p_property_id uuid, p_image_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.property_images where property_id = p_property_id)
     <> coalesce(cardinality(p_image_ids), 0)
     or exists (
       select 1 from unnest(p_image_ids) as x(id)
       where not exists (select 1 from public.property_images i where i.id = x.id and i.property_id = p_property_id)
     ) then
    raise exception 'The photo list is out of date. Reload the page and try again.' using errcode = 'P0001';
  end if;
  update public.property_images i
     set sort_order = o.ord
    from unnest(p_image_ids) with ordinality as o(id, ord)
   where i.id = o.id and i.property_id = p_property_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Duplicate check without inserting (import preview). Mirrors properties_rules().
-- SECURITY DEFINER so it sees every property; callable only with properties:create.
-- ---------------------------------------------------------------------------
create or replace function public.find_property_duplicate(
  p_kind public.property_kind, p_title text, p_location_text text,
  p_land_size numeric default null, p_land_size_unit public.land_size_unit default null)
returns table (id uuid, title text, status public.property_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_admin_permission('properties', 'create') then
    raise exception 'You do not have permission to check for duplicates.' using errcode = '42501';
  end if;
  return query
  select p.id, p.title, p.status
  from public.properties p
  where p.kind = p_kind
    and p.status <> 'archived'
    and extensions.similarity(lower(p.title), lower(p_title)) >= 0.6
    and (p.location_text is null or p_location_text is null
         or extensions.similarity(lower(p.location_text), lower(p_location_text)) >= 0.5)
    and (p.land_size is null or p_land_size is null
         or (p.land_size = p_land_size and p.land_size_unit = p_land_size_unit))
  order by extensions.similarity(lower(p.title), lower(p_title)) desc
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function
  public.set_property_cover(uuid, uuid),
  public.reorder_property_images(uuid, uuid[]),
  public.find_property_duplicate(public.property_kind, text, text, numeric, public.land_size_unit)
from public, anon;

grant execute on function
  public.set_property_cover(uuid, uuid),
  public.reorder_property_images(uuid, uuid[]),
  public.find_property_duplicate(public.property_kind, text, text, numeric, public.land_size_unit)
to authenticated, service_role;

revoke execute on function private.nigerian_states() from public, anon, authenticated;
-- Check constraints run with the writer's privileges.
grant execute on function private.nigerian_states() to authenticated, service_role;
