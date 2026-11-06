-- =============================================================================
-- 0021 Blog likes and comments (signed-in customers), site logo and favicon
-- =============================================================================

-- Published article check, usable in policies.
create or replace function private.is_post_published(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.blog_posts where id = p_post_id and status = 'published');
$$;

-- A customer account: has a customer profile and is not staff.
create or replace function private.is_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.customer_profiles where id = auth.uid())
     and not exists (select 1 from public.admin_users where id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Likes: one per customer per article.
-- ---------------------------------------------------------------------------
create table public.blog_post_likes (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, customer_id)
);
create index blog_post_likes_customer_idx on public.blog_post_likes (customer_id);

-- ---------------------------------------------------------------------------
-- Comments: plain text, shown immediately; customers delete their own, staff with
-- blog:delete delete any.
-- ---------------------------------------------------------------------------
create table public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  created_at timestamptz not null default now()
);
create index blog_comments_post_idx on public.blog_comments (post_id, created_at);
create index blog_comments_customer_idx on public.blog_comments (customer_id);
create index blog_comments_created_idx on public.blog_comments (created_at desc);

alter table public.blog_post_likes enable row level security;
alter table public.blog_comments enable row level security;

grant select, insert, delete on public.blog_post_likes to authenticated;
grant select, insert, delete on public.blog_comments to authenticated;

create policy "likes read own" on public.blog_post_likes for select to authenticated
  using (customer_id = (select auth.uid()));
create policy "likes add own" on public.blog_post_likes for insert to authenticated
  with check (customer_id = (select auth.uid()) and (select private.is_customer()) and private.is_post_published(post_id));
create policy "likes remove own" on public.blog_post_likes for delete to authenticated
  using (customer_id = (select auth.uid()));

create policy "comments read own or moderators" on public.blog_comments for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.has_admin_permission('blog', 'view')));
create policy "comments add own" on public.blog_comments for insert to authenticated
  with check (customer_id = (select auth.uid()) and (select private.is_customer()) and private.is_post_published(post_id));
create policy "comments remove own or moderators" on public.blog_comments for delete to authenticated
  using (customer_id = (select auth.uid()) or (select private.has_admin_permission('blog', 'delete')));

-- Public read: like count and comments of a published article. Commenters are shown by
-- first name and last initial only; no ids or emails leave the database.
create or replace function public.blog_post_engagement(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_post_published(p_post_id) then null else jsonb_build_object(
    'likes', (select count(*) from public.blog_post_likes where post_id = p_post_id),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'body', c.body,
               'created_at', c.created_at,
               'author', coalesce(nullif(btrim(
                  split_part(btrim(p.full_name), ' ', 1) || ' ' ||
                  left(nullif(split_part(btrim(p.full_name), ' ', 2), ''), 1) ||
                  case when split_part(btrim(p.full_name), ' ', 2) <> '' then '.' else '' end), ''), 'Customer'),
               'mine', c.customer_id = auth.uid()
             ) order by c.created_at)
      from public.blog_comments c
      left join public.customer_profiles p on p.id = c.customer_id
      where c.post_id = p_post_id
    ), '[]'::jsonb),
    'liked', exists (select 1 from public.blog_post_likes where post_id = p_post_id and customer_id = auth.uid())
  ) end;
$$;
revoke execute on function public.blog_post_engagement(uuid) from public;
grant execute on function public.blog_post_engagement(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Site logo and favicon (files in the public site-media bucket).
-- ---------------------------------------------------------------------------
alter table public.site_settings
  add column logo_path text check (char_length(logo_path) <= 500 and logo_path !~ '\.\.'),
  add column favicon_path text check (char_length(favicon_path) <= 500 and favicon_path !~ '\.\.');
