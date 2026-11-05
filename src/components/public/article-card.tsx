import Image from "next/image";
import Link from "next/link";
import type { ArticleCard as ArticleCardData } from "@/features/blog/queries";
import { formatDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/images";
import { cn } from "@/lib/cn";

export function ArticleCard({ article, large = false }: { article: ArticleCardData; large?: boolean }) {
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4",
        large && "md:grid md:grid-cols-[1.3fr_1fr] md:items-center md:gap-10",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface">
        {article.featured_image_path && (
          <Image
            src={publicStorageUrl("blog-media", article.featured_image_path)}
            alt=""
            fill
            sizes={
              large ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )}
      </div>
      <div className="flex flex-col gap-3">
        <p className="eyebrow">
          {[article.category?.name, article.published_at ? formatDate(article.published_at) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h3 className={cn("font-serif leading-snug text-ink", large ? "text-h2" : "text-h4")}>
          <Link href={`/blog/${article.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {article.title}
          </Link>
        </h3>
        {article.excerpt && (
          <p className={cn("text-stone", large ? "text-body" : "line-clamp-3 text-small")}>{article.excerpt}</p>
        )}
        {article.author?.name && <p className="text-small text-ink">By {article.author.name}</p>}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 hidden outline-2 outline-brand group-has-[a:focus-visible]:block"
      />
    </article>
  );
}

export function ArticleGrid({ articles }: { articles: ArticleCardData[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard article={article} />
        </li>
      ))}
    </ul>
  );
}
