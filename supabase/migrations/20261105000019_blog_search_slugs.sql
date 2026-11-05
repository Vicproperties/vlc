-- =============================================================================
-- 0019 Blog: full-text search over the article body, unique slugs (Stage 9)
-- =============================================================================

-- Plain-text version of the article (written by the application from the sanitised HTML),
-- so search covers the body and not only the title and excerpt.
alter table public.blog_posts add column content_text text check (char_length(content_text) <= 1000000);

drop index if exists public.blog_posts_search_idx;
alter table public.blog_posts drop column search_vector;
alter table public.blog_posts add column search_vector tsvector generated always as (
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, left(coalesce(content_text, ''), 200000)), 'C')
) stored;
create index blog_posts_search_idx on public.blog_posts using gin (search_vector);

-- Same rules as before, plus: slugs are generated from the title when empty and made unique
-- (adding -2, -3, ...) instead of failing on a duplicate.
create or replace function private.blog_posts_rules()
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
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  if tg_op = 'INSERT' or new.slug is distinct from old.slug or btrim(coalesce(new.slug, '')) = '' then
    base := left(private.slugify(coalesce(nullif(btrim(new.slug), ''), new.title)), 100);
    if base = '' then
      base := 'article';
    end if;
    candidate := base;
    while exists (select 1 from public.blog_posts where slug = candidate and id <> new.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
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
