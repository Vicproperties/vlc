-- =============================================================================
-- 0013 Indexes for foreign keys (Supabase performance advisor: unindexed_foreign_keys)
-- =============================================================================
-- Keeps joins fast and prevents full-table scans when referenced rows are deleted
-- (e.g. ON DELETE CASCADE / SET NULL when a user or property is removed).

create index if not exists admin_otp_challenges_admin_id_fk_idx on private.admin_otp_challenges (admin_id);
create index if not exists admin_users_created_by_fk_idx on public.admin_users (created_by);
create index if not exists analytics_events_session_id_fk_idx on public.analytics_events (session_id);
create index if not exists analytics_sessions_current_property_id_fk_idx on public.analytics_sessions (current_property_id);
create index if not exists blog_authors_admin_id_fk_idx on public.blog_authors (admin_id);
create index if not exists blog_posts_author_id_fk_idx on public.blog_posts (author_id);
create index if not exists contact_submissions_handled_by_fk_idx on public.contact_submissions (handled_by);
create index if not exists estates_created_by_fk_idx on public.estates (created_by);
create index if not exists import_jobs_uploaded_by_fk_idx on public.import_jobs (uploaded_by);
create index if not exists import_rows_duplicate_candidate_id_fk_idx on public.import_rows (duplicate_candidate_id);
create index if not exists import_rows_estate_match_id_fk_idx on public.import_rows (estate_match_id);
create index if not exists import_rows_property_id_fk_idx on public.import_rows (property_id);
create index if not exists inspection_requests_handled_by_fk_idx on public.inspection_requests (handled_by);
create index if not exists inspection_status_history_changed_by_fk_idx on public.inspection_status_history (changed_by);
create index if not exists media_assets_uploaded_by_fk_idx on public.media_assets (uploaded_by);
create index if not exists properties_building_type_id_fk_idx on public.properties (building_type_id);
create index if not exists properties_created_by_fk_idx on public.properties (created_by);
create index if not exists properties_duplicate_of_fk_idx on public.properties (duplicate_of);
create index if not exists properties_duplicate_reviewed_by_fk_idx on public.properties (duplicate_reviewed_by);
create index if not exists properties_updated_by_fk_idx on public.properties (updated_by);
