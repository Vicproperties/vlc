import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, Plus } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DeleteArticle } from "@/components/admin/delete-article";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Blog" };
const PAGE_SIZE = 25;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function BlogAdminPage({ searchParams }: PageProps<"/admin/blog">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BlogList searchParams={searchParams} />
    </Suspense>
  );
}

async function BlogList({ searchParams }: { searchParams: PageProps<"/admin/blog">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "blog", "view")) return <NoAccess section="the blog" />;
  const params = await searchParams;
  const status = ["draft", "published"].includes(one(params.status))
    ? (one(params.status) as "draft" | "published")
    : null;
  const q = one(params.q).trim().slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(params.page), 10) || 1));

  const supabase = await createClient();
  let query = supabase
    .from("blog_posts")
    .select("id, title, status, is_featured, published_at, updated_at, category:blog_categories(name)", {
      count: "exact",
    })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load articles.");
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    if (target > 1) sp.set("page", String(target));
    const text = sp.toString();
    return text ? `/admin/blog?${text}` : "/admin/blog";
  };

  return (
    <>
      <AdminPageHeader
        title="Blog"
        description={`${total} article${total === 1 ? "" : "s"}.`}
        actions={
          <>
            <ButtonLink href="/admin/blog/comments" variant="secondary">
              Comments
            </ButtonLink>
            <ButtonLink href="/admin/blog/categories" variant="secondary">
              Categories & authors
            </ButtonLink>
            {can(admin, "blog", "create") && (
              <ButtonLink href="/admin/blog/new" leadingIcon={<Plus className="size-4" aria-hidden="true" />}>
                New article
              </ButtonLink>
            )}
          </>
        }
      />
      {one(params.deleted) === "1" && <Notice tone="success">The article was deleted.</Notice>}
      <form method="get" role="search" className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="q" className="text-small font-medium text-ink">
            Search
          </label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Title or text" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-small font-medium text-ink">
            Status
          </label>
          <Select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            placeholder="All"
            options={[
              { value: "draft", label: "Drafts" },
              { value: "published", label: "Published" },
            ]}
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {(data ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q || status ? "No articles match" : "No articles yet"}
          description="Write an article or import one from Word."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Category</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              {can(admin, "blog", "delete") && (
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              )}
            </TR>
          </THead>
          <TBody>
            {(data ?? []).map((post) => (
              <TR key={post.id}>
                <TD>
                  <Link
                    href={`/admin/blog/${post.id}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                  {post.is_featured && <span className="mt-1 block text-caption text-brand">Featured article</span>}
                </TD>
                <TD>{post.category?.name ?? <span className="text-stone">None</span>}</TD>
                <TD>
                  <StatusText tone={post.status === "published" ? "success" : "neutral"}>
                    {post.status === "published" ? "Published" : "Draft"}
                  </StatusText>
                </TD>
                <TD className="whitespace-nowrap text-stone">{formatDate(post.updated_at)}</TD>
                {can(admin, "blog", "delete") && (
                  <TD className="text-right">
                    <DeleteArticle id={post.id} title={post.title} />
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} hrefFor={href} />
    </>
  );
}
