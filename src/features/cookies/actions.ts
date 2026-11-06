"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { requestMeta } from "@/features/auth/request-meta";
import { withinRateLimit } from "@/features/auth/security-log";
import { MARKETING_TAG } from "@/features/listings/tags";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Records a visitor's cookie choice anonymously (random id, no IP), so the dashboard can show
 * how many people accept. The choice itself lives in the visitor's own cookie.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordConsentAction(anonId: string, analytics: boolean, version: string): Promise<void> {
  if (!UUID.test(anonId) || typeof analytics !== "boolean" || typeof version !== "string" || version.length > 20)
    return;
  const meta = await requestMeta();
  if (!(await withinRateLimit(`consent:ip:${meta.ipHash}`, [20, 60 * 60]))) return;
  await createServiceClient()
    .from("cookie_consents")
    .insert({ anon_id: anonId, analytics, marketing: false, policy_version: version });
}

export interface CookieSettingsState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

function text(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, max + 100).trim() : "";
}

export async function saveCookieSettingsAction(
  _prev: CookieSettingsState,
  formData: FormData,
): Promise<CookieSettingsState> {
  await requireAdminPermission("cookies", "edit");
  const notice = text(formData, "notice_text", 2000);
  const analytics = text(formData, "analytics_description", 1000);
  const fieldErrors: Record<string, string> = {};
  if (notice.length > 2000) fieldErrors.notice_text = "Use 2,000 characters or fewer.";
  if (analytics.length > 1000) fieldErrors.analytics_description = "Use 1,000 characters or fewer.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const { data: current } = await supabase.from("cookie_settings").select("policy_version").eq("id", 1).single();
  const askAgain = formData.get("ask_again") === "on";
  const nextVersion = askAgain ? String((Number.parseInt(current?.policy_version ?? "1", 10) || 1) + 1) : undefined;
  const { error } = await supabase
    .from("cookie_settings")
    .update({
      notice_text: notice || null,
      analytics_description: analytics || null,
      enable_first_party_analytics: formData.get("enable_analytics") === "on",
      ...(nextVersion ? { policy_version: nextVersion } : {}),
    })
    .eq("id", 1);
  if (error) return { status: "error", message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: "cookies.settings_updated",
    p_entity_type: "cookie_settings",
    p_metadata: nextVersion ? { policy_version: nextVersion } : {},
  });
  updateTag(MARKETING_TAG);
  refresh();
  return {
    status: "success",
    message: nextVersion
      ? "Saved. Every visitor will be asked for their cookie choice again."
      : "Cookie settings saved.",
  };
}
