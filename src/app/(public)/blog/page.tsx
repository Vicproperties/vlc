import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, Search } from "lucide-react";
import { ArticleCard, ArticleGrid } from "@/components/public/article-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { BLOG_PAGE_SIZE, getActiveCategories, getFeaturedArticle, listArticles } from "@/features/blog/queries";
import { cn } from "@/lib/cn";
import { PageHero } from "@/components/public/page-hero";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function parse(params: Record<string, string | string[] | undefined>) {
  const category = one(params.category);
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).trim().replace(/\s+/g, " ").slice(0, 100),
    category: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(category) ? category : null,
    page: page >= 1 && page <= 1000 ? page : 1,
  };
}

function href(f: { q: string; category: string | null; page: number }) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.category) sp.set("category", f.category);
  if (f.page > 1) sp.set("page", String(f.page));
  const text = sp.toString();
  return text ? `/blog?${text}` : "/blog";
}

export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const f = parse(await searchParams);
  const filtered = Boolean(f.q || f.category);
  return {
    title: "Property news and guides",
    description: "News, guides and advice about buying, renting and leasing land and buildings.",
    alternates: { canonical: filtered ? "/blog" : href(f) },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="Blog"
        title="Property news and guides"
        text="News, guides and advice about land and property."
      />
      <Suspense
        fallback={
          <div className="container-content py-14">
            <Skeleton className="h-96" />
          </div>
        }
      >
        <BlogBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BlogBody({ searchParams }: { searchParams: PageProps<"/blog">["searchParams"] }) {
  const f = parse(await searchParams);
  const filtered = Boolean(f.q || f.category);
  const [featured, categories, { rows, total }] = await Promise.all([
    getFeaturedArticle(),
    getActiveCategories(),
    listArticles(f),
  ]);
  const showFeatured = featured && !filtered && f.page === 1;
  const list = showFeatured ? rows.filter((a) => a.id !== featured.id) : rows;
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));

  return (
    <div className="container-content flex flex-col gap-14 py-12 md:py-16">
      {showFeatured && (
        <section aria-label="Featured article">
          <ArticleCard article={featured} large />
        </section>
      )}

      <div className="flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
        {categories.length > 0 ? (
          <nav aria-label="Categories" className="flex flex-wrap gap-x-6 gap-y-2">
            {[{ name: "All articles", slug: null as string | null }, ...categories].map((c) => {
              const active = (c.slug ?? null) === f.category;
              return (
                <Link
                  key={c.slug ?? "all"}
                  href={href({ q: f.q, category: c.slug, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-b-2 pb-1 text-small",
                    active ? "border-brand font-medium text-ink" : "border-transparent text-stone hover:text-ink",
                  )}
                >
                  {c.name}
                </Link>
              );
            })}
          </nav>
        ) : (
          <span />
        )}
        <form action="/blog" method="get" role="search" aria-label="Search articles" className="flex gap-2">
          {f.category && <input type="hidden" name="category" value={f.category} />}
          <label htmlFor="blog-q" className="sr-only">
            Search articles
          </label>
          <Input id="blog-q" name="q" type="search" defaultValue={f.q} placeholder="Search articles" className="w-56" />
          <Button type="submit" variant="secondary" leadingIcon={<Search className="size-4" aria-hidden="true" />}>
            Search
          </Button>
        </form>
      </div>

      {list.length ? (
        <ArticleGrid articles={list} />
      ) : (
        <EmptyState
          icon={FileText}
          title={filtered ? "No articles match" : "No articles yet"}
          description={filtered ? "Try another search or category." : "New articles will appear here soon."}
          action={
            filtered ? (
              <Link href="/blog" className="text-small text-brand underline underline-offset-4">
                Show all articles
              </Link>
            ) : undefined
          }
        />
      )}
      <Pagination
        page={Math.min(f.page, totalPages)}
        totalPages={totalPages}
        hrefFor={(page) => href({ ...f, page })}
      />
    </div>
  );
}
