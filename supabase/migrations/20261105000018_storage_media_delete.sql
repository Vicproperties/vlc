-- =============================================================================
-- 0018 Storage: admins can delete media they manage (fix)
-- =============================================================================
-- Problem found in Stage 8: the Storage API deletes objects with a query that must first
-- SELECT them. Media buckets had no SELECT policy for authenticated users (public files are
-- served by URL without one), so deletions silently removed nothing and replaced/deleted
-- photos stayed in storage.
--
-- Fix:
--   * Admins who may write to or delete from a media bucket may also see its objects through
--     the API (the files are public anyway; this exposes no new data).
--   * Website images (site-media) may be deleted by the same admins who may upload them
--     (content, marketing or settings editors), not only media:delete.

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
      or (p_bucket = 'site-media' and (private.has_admin_permission('content', 'edit')
                                       or private.has_admin_permission('marketing', 'edit')
                                       or private.has_admin_permission('settings', 'edit')))
  end;
$$;

create policy "admins read managed media" on storage.objects for select to authenticated
  using (
    bucket_id in ('property-media', 'blog-media', 'site-media')
    and ((select private.can_write_bucket(bucket_id)) or (select private.can_delete_bucket_object(bucket_id)))
  );
