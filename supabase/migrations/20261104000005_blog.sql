-- =============================================================================
-- 0005 Blog: categories, authors, posts
-- =============================================================================

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Authors need not be administrators (guest writers).
create table public.blog_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  role_title text check (char_length(role_title) <= 120),
  bio text check (char_length(bio) <= 2000),
  photo_path text check (char_length(photo_path) <= 500),
  admin_id uuid references public.admin_users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  excerpt text check (char_length(excerpt) <= 500),
  featured_image_path text check (char_length(featured_image_path) <= 500),
  featured_image_alt text check (char_length(featured_image_alt) <= 300),
  category_id uuid references public.blog_categories (id) on delete set null,
  author_id uuid references public.blog_authors (id) on delete set null,
  -- TipTap JSON is the source of truth; content_html is sanitised server-side render output.
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb check (pg_column_size(content_json) <= 2000000),
  content_html text check (char_length(content_html) <= 2000000),
  status public.post_status not null default 'draft',
  is_featured boolean not null default false,
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(excerpt, '')), 'B')
  ) stored
);
create index blog_posts_published_idx on public.blog_posts (status, published_at desc);
create index blog_posts_category_idx on public.blog_posts (category_id, published_at desc);
create index blog_posts_search_idx on public.blog_posts using gin (search_vector);
-- Only one featured article at a time.
create unique index blog_posts_one_featured_idx on public.blog_posts (is_featured) where is_featured;

create or replace function private.blog_posts_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  if new.slug is null or btrim(new.slug) = '' then
    new.slug := left(private.slugify(new.title), 100);
  end if;

  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if not (private.is_service_role() or private.has_admin_permission('blog', 'publish')) then
      raise exception 'You do not have permission to publish or unpublish articles.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger blog_posts_rules before insert or update on public.blog_posts
  for each row execute function private.blog_posts_rules();

create or replace function private.blog_posts_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'published') or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.activity_logs (actor_id, actor_type, action, entity_type, entity_id, metadata)
    values (auth.uid(), case when auth.uid() is null then 'system' else 'admin' end,
            case when new.status = 'published' then 'blog.published' else 'blog.unpublished' end,
            'blog_post', new.id::text, jsonb_build_object('title', new.title));
  end if;
  return null;
end;
$$;

create trigger blog_posts_log_status after insert or update on public.blog_posts
  for each row execute function private.blog_posts_log_status();
