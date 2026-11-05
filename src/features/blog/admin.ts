import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Category and author options for the article form (RLS-scoped). */
export async function articleFormOptions(current?: { categoryId?: string | null; authorId?: string | null }) {
  const supabase = await createClient();
  const [categories, authors] = await Promise.all([
    supabase.from("blog_categories").select("id, name").order("sort_order").order("name"),
    supabase.from("blog_authors").select("id, name, is_active").order("name"),
  ]);
  return {
    categories: (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    authors: (authors.data ?? [])
      .filter((a) => a.is_active || a.id === current?.authorId)
      .map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (inactive)` })),
  };
}
