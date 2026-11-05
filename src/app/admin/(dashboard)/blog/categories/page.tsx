import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthorManager, CategoryManager } from "@/components/admin/blog-taxonomy";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { publicStorageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Blog categories and authors" };

export default function BlogTaxonomyPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Taxonomy />
    </Suspense>
  );
}

async function Taxonomy() {
  const admin = await requireAdmin();
  if (!can(admin, "blog", "view")) return <NoAccess section="the blog" />;
  const supabase = await createClient();
  const [categories, authors] = await Promise.all([
    supabase
      .from("blog_categories")
      .select("id, name, description, blog_posts(count)")
      .order("sort_order")
      .order("name"),
    supabase.from("blog_authors").select("id, name, role_title, bio, photo_path, is_active").order("name"),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Categories & authors"
        description={
          <Link href="/admin/blog" className="underline underline-offset-4">
            All articles
          </Link>
        }
      />
      <section className="flex flex-col gap-4">
        <h2 className="text-body font-semibold text-ink">Categories</h2>
        <CategoryManager
          categories={(categories.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description ?? "",
            count: (c.blog_posts as unknown as Array<{ count: number }>)[0]?.count ?? 0,
          }))}
          can={{
            create: can(admin, "blog", "create"),
            edit: can(admin, "blog", "edit"),
            delete: can(admin, "blog", "delete"),
          }}
        />
      </section>
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="text-body font-semibold text-ink">Authors</h2>
        <AuthorManager
          authors={(authors.data ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            roleTitle: a.role_title ?? "",
            bio: a.bio ?? "",
            photoUrl: a.photo_path ? publicStorageUrl("blog-media", a.photo_path) : null,
            isActive: a.is_active,
          }))}
          can={{ create: can(admin, "blog", "create"), edit: can(admin, "blog", "edit") }}
        />
      </section>
    </>
  );
}
