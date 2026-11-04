-- =============================================================================
-- 0016 Batch duplicate check for CSV import previews (Stage 5)
-- =============================================================================
-- Same matching rule as private.properties_rules() / find_property_duplicate(), applied to
-- up to 1,000 candidate rows in one call. SECURITY DEFINER so it sees every property;
-- requires properties:create. Returns only the matching property's id and title.

create or replace function public.find_property_duplicates(p_kind public.property_kind, p_rows jsonb)
returns table (idx integer, id uuid, title text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_admin_permission('properties', 'create') then
    raise exception 'You do not have permission to check for duplicates.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Provide at most 1000 rows.' using errcode = '22023';
  end if;

  return query
  select e.idx::integer, m.id, m.title
  from jsonb_array_elements(p_rows) with ordinality as e(item, idx)
  cross join lateral (
    select p.id, p.title
    from public.properties p
    where p.kind = p_kind
      and p.status <> 'archived'
      and extensions.similarity(lower(p.title), lower(e.item ->> 'title')) >= 0.6
      and (p.location_text is null or nullif(e.item ->> 'location_text', '') is null
           or extensions.similarity(lower(p.location_text), lower(e.item ->> 'location_text')) >= 0.5)
      and (p.land_size is null or nullif(e.item ->> 'land_size', '') is null
           or (p.land_size = (e.item ->> 'land_size')::numeric
               and p.land_size_unit::text = e.item ->> 'land_size_unit'))
    order by extensions.similarity(lower(p.title), lower(e.item ->> 'title')) desc
    limit 1
  ) m;
end;
$$;

revoke execute on function public.find_property_duplicates(public.property_kind, jsonb) from public, anon;
grant execute on function public.find_property_duplicates(public.property_kind, jsonb) to authenticated, service_role;
