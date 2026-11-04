import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env/client";

/**
 * Search engines may crawl the public site. The dashboard is also protected by sign-in and
 * sends `X-Robots-Tag: noindex`; listing it here only stops polite crawlers wasting effort.
 */
export default function robots(): MetadataRoute.Robots {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/design"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
