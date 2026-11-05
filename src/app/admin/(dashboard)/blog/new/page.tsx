import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleForm } from "@/components/admin/article-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { saveArticleAction } from "@/features/blog/actions";
import { articleFormOptions } from "@/features/blog/admin";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <NewArticle />
    </Suspense>
  );
}

async function NewArticle() {
  const admin = await requireAdmin();
  if (!can(admin, "blog", "create")) return <NoAccess section="writing articles" />;
  const options = await articleFormOptions();
  return (
    <>
      <AdminPageHeader title="New article" description="Write the article here, or import it from a Word document." />
      <ArticleForm
        action={saveArticleAction.bind(null, null)}
        categories={options.categories}
        authors={options.authors}
        canPublish={can(admin, "blog", "publish")}
        initial={{
          title: "",
          slug: "",
          excerpt: "",
          category_id: "",
          author_id: "",
          seo_title: "",
          seo_description: "",
          featured_image_alt: "",
          featuredImageUrl: null,
          isFeatured: false,
          status: "draft",
          contentJson: null,
        }}
      />
    </>
  );
}
