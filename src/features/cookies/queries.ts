import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { MARKETING_TAG } from "@/features/listings/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_ANALYTICS_DESCRIPTION, DEFAULT_NOTICE } from "./consent";

export interface PublicCookieSettings {
  notice: string;
  analyticsDescription: string;
  policyVersion: string;
  analyticsEnabled: boolean;
}

/** Cookie notice text and switches (public, cached; cleared when the dashboard saves). */
export async function getCookieSettings(): Promise<PublicCookieSettings> {
  "use cache";
  cacheTag(MARKETING_TAG);
  cacheLife("hours");
  const { data } = await createPublicClient()
    .from("cookie_settings")
    .select("notice_text, analytics_description, policy_version, enable_first_party_analytics")
    .eq("id", 1)
    .maybeSingle();
  return {
    notice: data?.notice_text || DEFAULT_NOTICE,
    analyticsDescription: data?.analytics_description || DEFAULT_ANALYTICS_DESCRIPTION,
    policyVersion: data?.policy_version ?? "1",
    analyticsEnabled: data?.enable_first_party_analytics ?? true,
  };
}
