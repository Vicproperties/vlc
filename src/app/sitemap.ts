import type { MetadataRoute } from "next";
import { getListingSitemapEntries } from "@/features/listings/queries";
import { publicEnv } from "@/lib/env/client";

/** Public pages and every listed property. Later stages add about, contact, blog, legal pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  const listings = await getListingSitemapEntries();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/properties`, changeFrequency: "daily", priority: 0.9 },
    ...listings
      .filter((listing) => listing.slug)
      .map((listing) => ({
        url: `${base}/properties/${listing.slug}`,
        lastModified: listing.updated_at ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
