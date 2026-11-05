import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CONTENT_TAG } from "@/features/listings/tags";
import { createPublicClient } from "@/lib/supabase/public";
import type { PageKey } from "./sections";

/**
 * Public content reads (anonymous client: RLS returns only visible/active/published rows).
 * Cached under the "site-content" tag, which every dashboard content change clears.
 */
export async function getPageSections(page: PageKey) {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("page_sections")
    .select("section_key, content")
    .eq("page_key", page)
    .eq("is_visible", true);
  return Object.fromEntries((data ?? []).map((row) => [row.section_key, row.content as Record<string, unknown>]));
}

export async function getCoreValues() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("core_values")
    .select("id, title, description")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getTeamMembers() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("team_members")
    .select("id, name, position, department, bio, photo_path, social_links")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getFaqs() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("faqs")
    .select("id, question, answer")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getLegalPage(slug: "privacy-policy" | "terms-and-conditions") {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("days");
  const { data } = await createPublicClient()
    .from("legal_pages")
    .select("slug, title, content_html, version, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data;
}

/** Everything the footer and contact page show. Only filled-in values are displayed. */
export async function getContactDetails() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("site_settings")
    .select(
      "company_name, tagline, phone_primary, phone_secondary, whatsapp_number, email_primary, address, map_embed_url, business_hours, social_links",
    )
    .eq("id", 1)
    .maybeSingle();
  return {
    tagline: data?.tagline ?? null,
    phonePrimary: data?.phone_primary ?? null,
    phoneSecondary: data?.phone_secondary ?? null,
    whatsapp: data?.whatsapp_number ?? null,
    email: data?.email_primary ?? null,
    address: data?.address ?? null,
    mapEmbedUrl: data?.map_embed_url ?? null,
    hours: Array.isArray(data?.business_hours)
      ? (data.business_hours as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
    social: (data?.social_links && typeof data.social_links === "object" ? data.social_links : {}) as Record<
      string,
      string
    >,
  };
}
