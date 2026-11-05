import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { ListingFilters } from "./filters";

/**
 * Public reads. Every query uses the anonymous client against the public read model
 * (`property_listings`, ADR-001), so only published/unavailable properties and public columns
 * are ever reachable. Results are cached and tagged "listings"; dashboard actions call
 * updateTag("listings") so changes appear immediately.
 */
import { CONTENT_TAG, LISTINGS_TAG } from "./tags";

export { CONTENT_TAG, LISTINGS_TAG };
export const LISTINGS_PAGE_SIZE = 12;

const CARD_COLUMNS =
  "id, kind, purpose, title, slug, city, state, location_text, status, regular_price, sales_price, instalment_price, instalment_note, price_period, promotion_active, discount_percent, effective_price, land_use, land_size, land_size_unit, building_type, bedrooms, bathrooms, cover_image_path, published_at";

export async function searchListings(filters: ListingFilters) {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  const from = (filters.page - 1) * LISTINGS_PAGE_SIZE;
  let query = supabase.from("property_listings").select(CARD_COLUMNS, { count: "exact" });

  if (filters.q) query = query.textSearch("search_vector", filters.q, { type: "websearch", config: "english" });
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.purpose) query = query.eq("purpose", filters.purpose);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.landUse) query = query.eq("land_use", filters.landUse);
  if (filters.buildingType) query = query.eq("building_type_slug", filters.buildingType);
  if (filters.minPrice !== null) query = query.gte("effective_price", filters.minPrice);
  if (filters.maxPrice !== null) query = query.lte("effective_price", filters.maxPrice);
  if (filters.bedrooms !== null) query = query.gte("bedrooms", filters.bedrooms);
  if (filters.availability === "available") query = query.eq("status", "published");
  if (filters.availability === "unavailable") query = query.eq("status", "unavailable");

  // Available listings first, then the chosen order.
  query = query.order("status", { ascending: true });
  if (filters.sort === "price_asc") query = query.order("effective_price", { ascending: true, nullsFirst: false });
  else if (filters.sort === "price_desc")
    query = query.order("effective_price", { ascending: false, nullsFirst: false });
  query = query.order("published_at", { ascending: false }).order("id");

  const { data, count, error } = await query.range(from, from + LISTINGS_PAGE_SIZE - 1);
  if (error) throw new Error("Unable to load properties.");
  return { rows: data ?? [], total: count ?? 0 };
}

export type ListingCardData = Awaited<ReturnType<typeof searchListings>>["rows"][number];

export async function getFeaturedListings(limit = 6) {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("property_listings")
    .select(CARD_COLUMNS)
    .eq("is_featured", true)
    .eq("status", "published")
    .order("featured_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to load featured properties.");
  return data ?? [];
}

export async function getLatestListings(limit = 6) {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("property_listings")
    .select(CARD_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to load properties.");
  return data ?? [];
}

export async function getListingBySlug(slug: string) {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null;

  const supabase = createPublicClient();
  const { data: listing, error } = await supabase
    .from("property_listings")
    .select(
      "id, kind, purpose, title, slug, description, description_html, address, city, state, location_text, google_maps_url, status, title_documentation, features, youtube_video_id, regular_price, sales_price, instalment_price, instalment_note, price_period, promotion_active, discount_percent, effective_price, land_use, dimensions, available_plots, land_size, land_size_unit, building_type, bedrooms, bathrooms, toilets, parking_spaces, seo_title, seo_description, og_image_path, cover_image_path, published_at, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load the property.");
  if (!listing?.id) return null;

  const { data: images } = await supabase
    .from("property_listing_images")
    .select("id, storage_path, alt_text, width, height, is_cover, sort_order")
    .eq("property_id", listing.id)
    .order("is_cover", { ascending: false })
    .order("sort_order");
  return { ...listing, images: images ?? [] };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

export async function getListingSitemapEntries() {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data } = await supabase.from("property_listings").select("slug, updated_at").limit(5000);
  return data ?? [];
}

export async function getPublicBuildingTypes() {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("days");
  const supabase = createPublicClient();
  const { data } = await supabase.from("building_types").select("name, slug").eq("is_active", true).order("sort_order");
  return data ?? [];
}

export async function getHomeSections() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("page_sections")
    .select("section_key, content")
    .eq("page_key", "home")
    .eq("is_visible", true);
  return new Map((data ?? []).map((row) => [row.section_key, row.content as Record<string, unknown>]));
}

export async function getWhyChooseUsItems() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("why_choose_us_items")
    .select("id, title, description")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getPublicSiteSettings() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("site_settings")
    .select(
      "company_name, tagline, whatsapp_number, phone_primary, email_primary, default_seo_title, default_seo_description",
    )
    .eq("id", 1)
    .maybeSingle();
  return data;
}

/** Published listings grouped by type and purpose (only groups that have listings). */
export async function getListingCategories() {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("property_listings")
    .select("kind, purpose")
    .eq("status", "published")
    .limit(10000);
  const counts = new Map<string, { kind: "land" | "building"; purpose: "sale" | "rent" | "lease"; count: number }>();
  for (const row of data ?? []) {
    if (!row.kind || !row.purpose) continue;
    const key = `${row.kind}:${row.purpose}`;
    const entry = counts.get(key) ?? { kind: row.kind, purpose: row.purpose, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}
