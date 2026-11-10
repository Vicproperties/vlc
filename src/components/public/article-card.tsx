import Image from "next/image";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import type { ArticleCard as ArticleCardData } from "@/features/blog/queries";
import { formatDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/images";
import { cn } from "@/lib/cn";

export function ArticleCard({ article, large = false }: { article: ArticleCardData; large?: boolean }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-line/70 bg-white shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-card-hover",
        large && "md:grid md:grid-cols-[1.3fr_1fr] md:items-center",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface">
        {article.featured_image_path ? (
          <Image
            src={publicStorageUrl("blog-media", article.featured_image_path)}
            alt=""
            fill
            sizes={
              large ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-brand-light">
            <Newspaper className="size-8" strokeWidth={1.25} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className={cn("flex flex-1 flex-col gap-3 p-5", large && "md:p-10")}>
        <p className="text-caption font-semibold tracking-[0.06em] text-brand uppercase">
          {[article.category?.name, article.published_at ? formatDate(article.published_at) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h3 className={cn("leading-snug text-ink", large ? "text-h2" : "text-h4")}>
          <Link href={`/blog/${article.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {article.title}
          </Link>
        </h3>
        {article.excerpt && (
          <p className={cn("text-stone", large ? "text-body" : "line-clamp-3 text-small")}>{article.excerpt}</p>
        )}
        {article.author?.name && <p className="mt-auto pt-1 text-small text-ink">By {article.author.name}</p>}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden rounded-[1.5rem] outline-2 -outline-offset-2 outline-brand group-has-[a:focus-visible]:block"
      />
    </article>
  );
}

export function ArticleGrid({ articles }: { articles: ArticleCardData[] }) {
  return (
    <ul data-reveal-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard article={article} />
        </li>
      ))}
    </ul>
  );
}
