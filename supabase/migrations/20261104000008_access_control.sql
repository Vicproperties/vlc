-- =============================================================================
-- 0008 Access control: privileges + Row Level Security on every table
-- =============================================================================
-- Model
--   anon           public visitors (publishable key, no session)
--   authenticated  any signed-in user: customers AND admins. Admin powers come only from
--                  private.has_admin_permission(), which requires an active admin_users row
--                  plus an OTP-verified session for the current JWT.
--   service_role   trusted server code; bypasses RLS. Used for public form submissions,
--                  analytics ingestion, admin account management and imports.
--
-- Two layers: table privileges (what a role may ever attempt) and RLS policies (which rows).
-- Policies wrap helper calls in (select ...) so Postgres evaluates them once per statement.

-- ---------------------------------------------------------------------------
-- 1. Remove all default access, then grant explicitly
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- RLS policies call helper functions in `private` with the caller's privileges, so the
-- roles need USAGE on the schema. The schema is not exposed by the Data API, and its
-- tables carry no grants, so this does not make private data reachable.
grant usage on schema private to anon, authenticated;
revoke execute on function private.purge_expired_logs() from public, anon, authenticated;
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

-- Callable RPCs
grant execute on function public.my_admin_permissions() to authenticated;
grant execute on function public.log_activity(text, text, text, jsonb) to authenticated;
-- admin_session_*, check_rate_limit, log_activity_as, log_security_event: service_role only.

-- Public read models
grant select on public.property_listings, public.property_listing_images to anon, authenticated;
grant select on public.my_inspection_requests to authenticated;

-- Public-readable content (rows filtered by RLS)
grant select on
  public.building_types, public.blog_categories, public.blog_authors, public.blog_posts,
  public.site_settings, public.page_sections, public.core_values, public.why_choose_us_items,
  public.team_members, public.faqs, public.legal_pages, public.announcements, public.top_banners,
  public.cookie_settings
to anon, authenticated;

-- Customer self-service
grant select on public.customer_profiles to authenticated;
grant update (full_name, avatar_url, phone) on public.customer_profiles to authenticated;
grant select, insert, delete on public.favourites to authenticated;

-- Admin-managed tables (every row still filtered by permission-checking policies)
grant select on public.admin_users, public.admin_permissions, public.activity_logs, public.security_events to authenticated;
grant select, insert, update, delete on
  public.estates, public.properties, public.property_images, public.building_types,
  public.blog_categories, public.blog_authors, public.blog_posts,
  public.page_sections, public.core_values, public.why_choose_us_items, public.team_members, public.faqs,
  public.announcements, public.top_banners, public.media_assets, public.import_jobs, public.import_rows
to authenticated;
grant insert, update on public.legal_pages to authenticated;
grant update on public.site_settings, public.cookie_settings to authenticated;
grant select, update, delete on public.inspection_requests, public.contact_submissions, public.newsletter_subscribers to authenticated;
grant select on public.inspection_status_history, public.cookie_consents,
  public.analytics_sessions, public.analytics_events, public.analytics_daily to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
  for t in select tablename from pg_tables where schemaname = 'private' loop
    execute format('alter table private.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Policies
-- ---------------------------------------------------------------------------

-- Identity & security -------------------------------------------------------
create policy "admins read self or with admins:view" on public.admin_users for select to authenticated
  using (id = (select auth.uid()) or (select private.has_admin_permission('admins', 'view')));

create policy "admins read own or with admins:view" on public.admin_permissions for select to authenticated
  using (admin_id = (select auth.uid()) or (select private.has_admin_permission('admins', 'view')));

create policy "activity log readers" on public.activity_logs for select to authenticated
  using ((select private.has_admin_permission('activity_logs', 'view')));

create policy "security events: super admins only" on public.security_events for select to authenticated
  using ((select private.is_super_admin()));

create policy "customers read own profile" on public.customer_profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_admin_permission('customers', 'view')));
create policy "customers update own profile" on public.customer_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Estates (internal) --------------------------------------------------------
create policy "estates read" on public.estates for select to authenticated
  using ((select private.has_admin_permission('estates', 'view')) or (select private.has_admin_permission('properties', 'view')));
create policy "estates create" on public.estates for insert to authenticated
  with check ((select private.has_admin_permission('estates', 'create')));
create policy "estates edit" on public.estates for update to authenticated
  using ((select private.has_admin_permission('estates', 'edit')))
  with check ((select private.has_admin_permission('estates', 'edit')));
create policy "estates delete" on public.estates for delete to authenticated
  using ((select private.has_admin_permission('estates', 'delete')));

-- Building types ------------------------------------------------------------
create policy "building types public read" on public.building_types for select to anon, authenticated
  using (is_active or (select private.has_admin_permission('properties', 'view')));
create policy "building types create" on public.building_types for insert to authenticated
  with check ((select private.has_admin_permission('properties', 'edit')));
create policy "building types edit" on public.building_types for update to authenticated
  using ((select private.has_admin_permission('properties', 'edit')))
  with check ((select private.has_admin_permission('properties', 'edit')));
create policy "building types delete" on public.building_types for delete to authenticated
  using ((select private.has_admin_permission('properties', 'delete')));

-- Properties (public reads go through public.property_listings) -------------
create policy "properties read" on public.properties for select to authenticated
  using ((select private.has_admin_permission('properties', 'view')));
create policy "properties create" on public.properties for insert to authenticated
  with check ((select private.has_admin_permission('properties', 'create')));
create policy "properties edit" on public.properties for update to authenticated
  using ((select private.has_admin_permission('properties', 'edit')))
  with check ((select private.has_admin_permission('properties', 'edit')));
create policy "properties delete" on public.properties for delete to authenticated
  using ((select private.has_admin_permission('properties', 'delete')));

create policy "property images read" on public.property_images for select to authenticated
  using ((select private.has_admin_permission('properties', 'view')));
create policy "property images create" on public.property_images for insert to authenticated
  with check ((select private.has_admin_permission('properties', 'create')) or (select private.has_admin_permission('properties', 'edit')));
create policy "property images edit" on public.property_images for update to authenticated
  using ((select private.has_admin_permission('properties', 'edit')))
  with check ((select private.has_admin_permission('properties', 'edit')));
create policy "property images delete" on public.property_images for delete to authenticated
  using ((select private.has_admin_permission('properties', 'edit')));

-- Enquiries -------------------------------------------------------------------
create policy "inspections read" on public.inspection_requests for select to authenticated
  using ((select private.has_admin_permission('inspections', 'view')));
create policy "inspections edit" on public.inspection_requests for update to authenticated
  using ((select private.has_admin_permission('inspections', 'edit')))
  with check ((select private.has_admin_permission('inspections', 'edit')));
create policy "inspections delete" on public.inspection_requests for delete to authenticated
  using ((select private.has_admin_permission('inspections', 'delete')));
create policy "inspection history read" on public.inspection_status_history for select to authenticated
  using ((select private.has_admin_permission('inspections', 'view')));

create policy "contact read" on public.contact_submissions for select to authenticated
  using ((select private.has_admin_permission('enquiries', 'view')));
create policy "contact edit" on public.contact_submissions for update to authenticated
  using ((select private.has_admin_permission('enquiries', 'edit')))
  with check ((select private.has_admin_permission('enquiries', 'edit')));
create policy "contact delete" on public.contact_submissions for delete to authenticated
  using ((select private.has_admin_permission('enquiries', 'delete')));

create policy "favourites read own" on public.favourites for select to authenticated
  using (customer_id = (select auth.uid()));
create policy "favourites add own listed" on public.favourites for insert to authenticated
  with check (customer_id = (select auth.uid()) and private.is_property_listed(property_id));
create policy "favourites remove own" on public.favourites for delete to authenticated
  using (customer_id = (select auth.uid()));

create policy "newsletter read" on public.newsletter_subscribers for select to authenticated
  using ((select private.has_admin_permission('newsletter', 'view')));
create policy "newsletter edit" on public.newsletter_subscribers for update to authenticated
  using ((select private.has_admin_permission('newsletter', 'edit')))
  with check ((select private.has_admin_permission('newsletter', 'edit')));
create policy "newsletter delete" on public.newsletter_subscribers for delete to authenticated
  using ((select private.has_admin_permission('newsletter', 'delete')));

-- Blog ------------------------------------------------------------------------
create policy "blog categories public read" on public.blog_categories for select to anon, authenticated using (true);
create policy "blog categories create" on public.blog_categories for insert to authenticated
  with check ((select private.has_admin_permission('blog', 'create')));
create policy "blog categories edit" on public.blog_categories for update to authenticated
  using ((select private.has_admin_permission('blog', 'edit'))) with check ((select private.has_admin_permission('blog', 'edit')));
create policy "blog categories delete" on public.blog_categories for delete to authenticated
  using ((select private.has_admin_permission('blog', 'delete')));

create policy "blog authors public read" on public.blog_authors for select to anon, authenticated
  using (is_active or (select private.has_admin_permission('blog', 'view')));
create policy "blog authors create" on public.blog_authors for insert to authenticated
  with check ((select private.has_admin_permission('blog', 'create')));
create policy "blog authors edit" on public.blog_authors for update to authenticated
  using ((select private.has_admin_permission('blog', 'edit'))) with check ((select private.has_admin_permission('blog', 'edit')));
create policy "blog authors delete" on public.blog_authors for delete to authenticated
  using ((select private.has_admin_permission('blog', 'delete')));

create policy "blog posts public read" on public.blog_posts for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select private.has_admin_permission('blog', 'view')));
create policy "blog posts create" on public.blog_posts for insert to authenticated
  with check ((select private.has_admin_permission('blog', 'create')));
create policy "blog posts edit" on public.blog_posts for update to authenticated
  using ((select private.has_admin_permission('blog', 'edit'))) with check ((select private.has_admin_permission('blog', 'edit')));
create policy "blog posts delete" on public.blog_posts for delete to authenticated
  using ((select private.has_admin_permission('blog', 'delete')));

-- Website content -------------------------------------------------------------
create policy "site settings public read" on public.site_settings for select to anon, authenticated using (true);
create policy "site settings edit" on public.site_settings for update to authenticated
  using ((select private.has_admin_permission('settings', 'edit'))) with check ((select private.has_admin_permission('settings', 'edit')));

create policy "page sections public read" on public.page_sections for select to anon, authenticated
  using (is_visible or (select private.has_admin_permission('content', 'view')));
create policy "page sections create" on public.page_sections for insert to authenticated
  with check ((select private.has_admin_permission('content', 'edit')));
create policy "page sections edit" on public.page_sections for update to authenticated
  using ((select private.has_admin_permission('content', 'edit'))) with check ((select private.has_admin_permission('content', 'edit')));
create policy "page sections delete" on public.page_sections for delete to authenticated
  using ((select private.has_admin_permission('content', 'delete')));

do $$
declare t text;
begin
  foreach t in array array['core_values', 'why_choose_us_items', 'team_members', 'faqs'] loop
    execute format($f$create policy "%1$s public read" on public.%1$I for select to anon, authenticated
      using (is_active or (select private.has_admin_permission('content', 'view')))$f$, t);
    execute format($f$create policy "%1$s create" on public.%1$I for insert to authenticated
      with check ((select private.has_admin_permission('content', 'create')))$f$, t);
    execute format($f$create policy "%1$s edit" on public.%1$I for update to authenticated
      using ((select private.has_admin_permission('content', 'edit')))
      with check ((select private.has_admin_permission('content', 'edit')))$f$, t);
    execute format($f$create policy "%1$s delete" on public.%1$I for delete to authenticated
      using ((select private.has_admin_permission('content', 'delete')))$f$, t);
  end loop;
end;
$$;

create policy "legal pages public read" on public.legal_pages for select to anon, authenticated
  using (is_published or (select private.has_admin_permission('content', 'view')));
create policy "legal pages create" on public.legal_pages for insert to authenticated
  with check ((select private.has_admin_permission('content', 'edit')));
create policy "legal pages edit" on public.legal_pages for update to authenticated
  using ((select private.has_admin_permission('content', 'edit'))) with check ((select private.has_admin_permission('content', 'edit')));

-- Marketing ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['announcements', 'top_banners'] loop
    execute format($f$create policy "%1$s public read" on public.%1$I for select to anon, authenticated
      using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
             or (select private.has_admin_permission('marketing', 'view')))$f$, t);
    execute format($f$create policy "%1$s create" on public.%1$I for insert to authenticated
      with check ((select private.has_admin_permission('marketing', 'create')))$f$, t);
    execute format($f$create policy "%1$s edit" on public.%1$I for update to authenticated
      using ((select private.has_admin_permission('marketing', 'edit')))
      with check ((select private.has_admin_permission('marketing', 'edit')))$f$, t);
    execute format($f$create policy "%1$s delete" on public.%1$I for delete to authenticated
      using ((select private.has_admin_permission('marketing', 'delete')))$f$, t);
  end loop;
end;
$$;

create policy "cookie settings public read" on public.cookie_settings for select to anon, authenticated using (true);
create policy "cookie settings edit" on public.cookie_settings for update to authenticated
  using ((select private.has_admin_permission('cookies', 'edit'))) with check ((select private.has_admin_permission('cookies', 'edit')));
create policy "cookie consents read" on public.cookie_consents for select to authenticated
  using ((select private.has_admin_permission('cookies', 'view')));

-- Media library ---------------------------------------------------------------------
create policy "media read" on public.media_assets for select to authenticated
  using ((select private.is_verified_admin()));
create policy "media register" on public.media_assets for insert to authenticated
  with check ((select private.is_verified_admin()) and uploaded_by = (select auth.uid()));
create policy "media edit" on public.media_assets for update to authenticated
  using ((select private.has_admin_permission('media', 'edit'))) with check ((select private.has_admin_permission('media', 'edit')));
create policy "media delete" on public.media_assets for delete to authenticated
  using ((select private.has_admin_permission('media', 'delete')));

-- Imports -----------------------------------------------------------------------------
create policy "import jobs" on public.import_jobs for all to authenticated
  using ((select private.has_admin_permission('properties', 'create')))
  with check ((select private.has_admin_permission('properties', 'create')));
create policy "import rows" on public.import_rows for all to authenticated
  using ((select private.has_admin_permission('properties', 'create')))
  with check ((select private.has_admin_permission('properties', 'create')));

-- Analytics -----------------------------------------------------------------------------
create policy "analytics sessions read" on public.analytics_sessions for select to authenticated
  using ((select private.has_admin_permission('analytics', 'view')));
create policy "analytics events read" on public.analytics_events for select to authenticated
  using ((select private.has_admin_permission('analytics', 'view')));
create policy "analytics daily read" on public.analytics_daily for select to authenticated
  using ((select private.has_admin_permission('analytics', 'view')));
