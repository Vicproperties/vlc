import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { MARKETING_TAG } from "@/features/listings/tags";
import { publicStorageUrl } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Public marketing reads (anonymous client: RLS returns only active rows inside their
 * schedule). Cached for minutes so start/end times take effect without a deploy; every
 * dashboard change clears the tag immediately.
 */
export interface PublicBanner {
  id: string;
  message: string;
  type: "information" | "promotion" | "notice";
  linkUrl: string | null;
  ctaLabel: string | null;
}

export interface PublicAnnouncement {
  id: string;
  version: number;
  heading: string;
  message: string | null;
  imageUrl: string | null;
  imageAlt: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  frequency: "once" | "once_per_days" | "once_per_session";
  frequencyDays: number | null;
}

export async function getActiveBanner(): Promise<PublicBanner | null> {
  "use cache";
  cacheTag(MARKETING_TAG);
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("top_banners")
    .select("id, message, type, link_url, cta_label")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, message: data.message, type: data.type, linkUrl: data.link_url, ctaLabel: data.cta_label };
}

export async function getActiveAnnouncement(): Promise<PublicAnnouncement | null> {
  "use cache";
  cacheTag(MARKETING_TAG);
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("announcements")
    .select("id, version, heading, message, image_path, image_alt, cta_label, cta_url, frequency, frequency_days")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    version: data.version,
    heading: data.heading,
    message: data.message,
    imageUrl: data.image_path ? publicStorageUrl("site-media", data.image_path) : null,
    imageAlt: data.image_alt ?? "",
    ctaLabel: data.cta_label,
    ctaUrl: data.cta_url,
    frequency: data.frequency,
    frequencyDays: data.frequency_days,
  };
}
