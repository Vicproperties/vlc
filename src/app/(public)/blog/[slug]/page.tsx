import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleGrid } from "@/components/public/article-card";
import { JsonLd } from "@/components/public/json-ld";
import { ShareButtons } from "@/components/public/share-buttons";
import { siteConfig } from "@/config/site";
import { getArticle, getArticleSitemapEntries, getRelatedArticles } from "@/features/blog/queries";
import { sanitizeArticleHtml } from "@/lib/article-html";
import { publicEnv } from "@/lib/env/client";
import { formatDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/images";

/** Recent articles are prerendered; a placeholder is needed while none exist (Cache Components). */
export async function generateStaticParams() {
  const entries = await getArticleSitemapEntries();
  const slugs = entries.flatMap((e) => (e.slug ? [{ slug: e.slug }] : [])).slice(0, 100);
  return slugs.length ? slugs : [{ slug: "__no-articles__" }];
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found", robots: { index: false } };
  const description = (article.seo_description ?? article.excerpt ?? "").slice(0, 160) || undefined;
  return {
    title: article.seo_title ?? article.title,
    description,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.seo_title ?? article.title,
      description,
      url: `/blog/${article.slug}`,
      publishedTime: article.published_at ?? undefined,
      images: article.featured_image_path
        ? [{ url: publicStorageUrl("blog-media", article.featured_image_path) }]
        : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const related = await getRelatedArticles(article.id, article.category_id);
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  const url = `${siteUrl}/blog/${article.slug}`;
  // Sanitised on save; sanitised again here so content written any other way cannot inject markup.
  const html = article.content_html ? sanitizeArticleHtml(article.content_html) : "";
  const image = article.featured_image_path ? publicStorageUrl("blog-media", article.featured_image_path) : null;

  return (
    <article className="flex flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.excerpt ?? undefined,
          image: image ? [image] : undefined,
          datePublished: article.published_at ?? undefined,
          dateModified: article.updated_at,
          author: article.author?.name ? { "@type": "Person", name: article.author.name } : undefined,
          publisher: { "@type": "Organization", name: siteConfig.name, url: siteUrl },
          mainEntityOfPage: url,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
            { "@type": "ListItem", position: 3, name: article.title, item: url },
          ],
        }}
      />

      <header className="container-content flex max-w-4xl flex-col gap-5 py-10 md:py-14">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-small text-stone">
            <li>
              <Link href="/" className="hover:text-ink hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/blog" className="hover:text-ink hover:underline">
                Blog
              </Link>
            </li>
            {article.category && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/blog?category=${article.category.slug}`} className="hover:text-ink hover:underline">
                    {article.category.name}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>
        <h1 className="text-h1">{article.title}</h1>
        {article.excerpt && <p className="text-h4 font-normal text-stone">{article.excerpt}</p>}
        <p className="text-small text-stone">
          {[
            article.author?.name ? `By ${article.author.name}` : null,
            article.published_at ? formatDate(article.published_at) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {image && (
        <div className="container-content">
          <div className="relative aspect-[16/9] overflow-hidden bg-surface">
            <Image
              src={image}
              alt={article.featured_image_alt ?? ""}
              fill
              priority
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="container-content flex max-w-3xl flex-col gap-10 py-10 md:py-14">
        {html && <div className="rich-text article text-body text-ink" dangerouslySetInnerHTML={{ __html: html }} />}
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 className="text-small font-medium text-ink">Share this article</h2>
          <ShareButtons url={url} title={article.title} />
        </div>
        {article.author?.name && article.author.bio && (
          <aside className="flex gap-4 border-t border-line pt-6" aria-label="About the author">
            {article.author.photo_path && (
              <Image
                src={publicStorageUrl("blog-media", article.author.photo_path)}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 object-cover"
              />
            )}
            <div className="flex flex-col gap-1">
              <p className="font-medium text-ink">{article.author.name}</p>
              {article.author.role_title && <p className="text-small text-stone">{article.author.role_title}</p>}
              <p className="text-small text-ink">{article.author.bio}</p>
            </div>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="border-t border-line bg-surface" aria-labelledby="related-heading">
          <div className="container-content flex flex-col gap-10 py-14">
            <h2 id="related-heading" className="text-h2">
              Related articles
            </h2>
            <ArticleGrid articles={related} />
          </div>
        </section>
      )}
    </article>
  );
}
