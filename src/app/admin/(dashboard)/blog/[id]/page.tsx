import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleForm } from "@/components/admin/article-form";
import { DeleteArticle } from "@/components/admin/delete-article";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { saveArticleAction } from "@/features/blog/actions";
import { articleFormOptions } from "@/features/blog/admin";
import { formatDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit article" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditArticlePage({ params, searchParams }: PageProps<"/admin/blog/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <EditArticle params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditArticle({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/blog/[id]">["params"];
  searchParams: PageProps<"/admin/blog/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const admin = await requireAdmin();
  if (!can(admin, "blog", "view")) return <NoAccess section="the blog" />;

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, category_id, author_id, content_json, featured_image_path, featured_image_alt, status, is_featured, seo_title, seo_description, published_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();
  const options = await articleFormOptions({ categoryId: post.category_id, authorId: post.author_id });

  return (
    <>
      <AdminPageHeader
        title={post.title}
        actions={can(admin, "blog", "delete") ? <DeleteArticle id={post.id} title={post.title} /> : undefined}
        description={
          <>
            {post.status === "published" && post.published_at ? `Published ${formatDate(post.published_at)}` : "Draft"}{" "}
            · last saved {formatDate(post.updated_at)} ·{" "}
            {post.status === "published" && (
              <>
                <Link href={`/blog/${post.slug}`} className="underline underline-offset-4">
                  View on the website
                </Link>{" "}
                ·{" "}
              </>
            )}
            <Link href="/admin/blog" className="underline underline-offset-4">
              All articles
            </Link>
          </>
        }
      />
      {query.created === "1" && <Notice tone="success">Article saved as a draft.</Notice>}
      {can(admin, "blog", "edit") ? (
        <ArticleForm
          key={post.updated_at}
          action={saveArticleAction.bind(null, post.id)}
          categories={options.categories}
          authors={options.authors}
          canPublish={can(admin, "blog", "publish")}
          initial={{
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? "",
            category_id: post.category_id ?? "",
            author_id: post.author_id ?? "",
            seo_title: post.seo_title ?? "",
            seo_description: post.seo_description ?? "",
            featured_image_alt: post.featured_image_alt ?? "",
            featuredImageUrl: post.featured_image_path
              ? publicStorageUrl("blog-media", post.featured_image_path)
              : null,
            isFeatured: post.is_featured,
            status: post.status,
            contentJson: post.content_json,
          }}
        />
      ) : (
        <Notice tone="info">You can view this article but not edit it.</Notice>
      )}
    </>
  );
}
