import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { BLOG_TAG } from "./tags";

/**
 * Public blog reads (anonymous client: RLS returns only published articles whose publication
 * date has passed). Cached under the "blog" tag, cleared by every dashboard blog change.
 */
export const BLOG_PAGE_SIZE = 9;
const CARD =
  "id, title, slug, excerpt, featured_image_path, featured_image_alt, published_at, category:blog_categories(name, slug), author:blog_authors(name)";

export async function listArticles(filters: { q: string; category: string | null; page: number }) {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  let categoryId: string | null = null;
  if (filters.category) {
    const { data } = await supabase.from("blog_categories").select("id").eq("slug", filters.category).maybeSingle();
    if (!data) return { rows: [], total: 0 };
    categoryId = data.id;
  }
  const from = (filters.page - 1) * BLOG_PAGE_SIZE;
  let query = supabase
    .from("blog_posts")
    .select(CARD, { count: "exact" })
    .order("published_at", { ascending: false })
    .range(from, from + BLOG_PAGE_SIZE - 1);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (filters.q) query = query.textSearch("search_vector", filters.q, { type: "websearch", config: "english" });
  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load articles.");
  return { rows: data ?? [], total: count ?? 0 };
}

export type ArticleCard = Awaited<ReturnType<typeof listArticles>>["rows"][number];

export async function getFeaturedArticle() {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient().from("blog_posts").select(CARD).eq("is_featured", true).maybeSingle();
  return data;
}

export async function getLatestArticles(limit = 3) {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("blog_posts")
    .select(CARD)
    .order("published_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Categories that have at least one published article ("dynamic categories"). */
export async function getActiveCategories() {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const [{ data: categories }, { data: posts }] = await Promise.all([
    supabase.from("blog_categories").select("id, name, slug").order("sort_order").order("name"),
    supabase.from("blog_posts").select("category_id").not("category_id", "is", null).limit(5000),
  ]);
  const used = new Set((posts ?? []).map((p) => p.category_id));
  return (categories ?? []).filter((c) => used.has(c.id));
}

export async function getArticle(slug: string) {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null;
  const { data } = await createPublicClient()
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, content_html, featured_image_path, featured_image_alt, published_at, updated_at, seo_title, seo_description, category_id, category:blog_categories(name, slug), author:blog_authors(name, role_title, bio, photo_path)",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

/** Up to 3 other articles: same category first, then the latest. */
export async function getRelatedArticles(articleId: string, categoryId: string | null) {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const same = categoryId
    ? ((
        await supabase
          .from("blog_posts")
          .select(CARD)
          .eq("category_id", categoryId)
          .neq("id", articleId)
          .order("published_at", { ascending: false })
          .limit(3)
      ).data ?? [])
    : [];
  if (same.length >= 3) return same;
  const { data: latest } = await supabase
    .from("blog_posts")
    .select(CARD)
    .neq("id", articleId)
    .order("published_at", { ascending: false })
    .limit(6);
  const ids = new Set(same.map((a) => a.id));
  return [...same, ...(latest ?? []).filter((a) => !ids.has(a.id))].slice(0, 3);
}

export async function getArticleSitemapEntries() {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient().from("blog_posts").select("slug, updated_at").limit(5000);
  return data ?? [];
}
