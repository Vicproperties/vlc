-- =============================================================================
-- 0009 Storage buckets & object policies
-- =============================================================================
-- Public buckets serve images by URL (read access needs no policy). Writes require a
-- verified admin with the relevant module permission. Uploads normally use server-issued
-- signed upload URLs; these policies are the safety net for direct API calls.
-- SVG is deliberately not allowed (it can carry scripts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('property-media', 'property-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('blog-media', 'blog-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-media', 'site-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('imports', 'imports', false, 20971520, array[
    'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Which permission governs writes to each bucket.
create or replace function private.can_write_bucket(p_bucket text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_bucket
    when 'property-media' then private.has_admin_permission('properties', 'create')
                            or private.has_admin_permission('properties', 'edit')
                            or private.has_admin_permission('media', 'create')
    when 'blog-media' then private.has_admin_permission('blog', 'create')
                        or private.has_admin_permission('blog', 'edit')
                        or private.has_admin_permission('media', 'create')
    when 'site-media' then private.has_admin_permission('content', 'edit')
                        or private.has_admin_permission('marketing', 'edit')
                        or private.has_admin_permission('settings', 'edit')
                        or private.has_admin_permission('media', 'create')
    when 'imports' then private.has_admin_permission('properties', 'create')
                     or private.has_admin_permission('blog', 'create')
    else false
  end;
$$;

create or replace function private.can_delete_bucket_object(p_bucket text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_bucket
    when 'imports' then private.is_verified_admin()
    else private.has_admin_permission('media', 'delete')
      or (p_bucket = 'property-media' and private.has_admin_permission('properties', 'edit'))
      or (p_bucket = 'blog-media' and private.has_admin_permission('blog', 'edit'))
  end;
$$;

grant execute on function private.can_write_bucket(text), private.can_delete_bucket_object(text) to authenticated;

-- Object names must be safe: no traversal, no leading slash, limited character set.
create or replace function private.is_safe_object_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ '^[a-z0-9][a-z0-9/_.-]{0,250}$' and p_name !~ '\.\.' and p_name !~ '//';
$$;

create policy "admins upload media" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('property-media', 'blog-media', 'site-media', 'imports')
    and private.is_safe_object_name(name)
    and (select private.can_write_bucket(bucket_id))
  );

create policy "admins update media" on storage.objects for update to authenticated
  using (bucket_id in ('property-media', 'blog-media', 'site-media') and (select private.can_write_bucket(bucket_id)))
  with check (bucket_id in ('property-media', 'blog-media', 'site-media') and private.is_safe_object_name(name)
              and (select private.can_write_bucket(bucket_id)));

create policy "admins delete media" on storage.objects for delete to authenticated
  using (
    bucket_id in ('property-media', 'blog-media', 'site-media', 'imports')
    and (select private.can_delete_bucket_object(bucket_id))
    and (bucket_id <> 'imports' or owner_id = (select auth.uid())::text)
  );

-- Private import files: only the uploader can read them back.
create policy "uploader reads own import files" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and owner_id = (select auth.uid())::text and (select private.is_verified_admin()));
