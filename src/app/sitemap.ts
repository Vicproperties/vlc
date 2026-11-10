import type { MetadataRoute } from "next";
import { getArticleSitemapEntries } from "@/features/blog/queries";
import { getListingSitemapEntries } from "@/features/listings/queries";
import { publicEnv } from "@/lib/env/client";

/** Public pages and every listed property. Later stages add about, contact, blog, legal pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  const [listings, articles] = await Promise.all([getListingSitemapEntries(), getArticleSitemapEntries()]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/properties`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/team`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.2 },
    ...listings
      .filter((listing) => listing.slug)
      .map((listing) => ({
        url: `${base}/properties/${listing.slug}`,
        lastModified: listing.updated_at ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...articles
      .filter((article) => article.slug)
      .map((article) => ({
        url: `${base}/blog/${article.slug}`,
        lastModified: article.updated_at ?? undefined,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
  ];
}
