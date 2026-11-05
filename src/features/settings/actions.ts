"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { parsePhoneStrict } from "@/features/enquiries/server";
import { CONTENT_TAG } from "@/features/listings/tags";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_NETWORKS } from "./networks";

/**
 * Website Settings (module "settings"): company contact details, opening hours, social
 * links and default search-engine text. Used across the public site.
 */
export interface SettingsFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function text(formData: FormData, key: string, max = 2000): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

export async function saveSiteSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdminPermission("settings", "edit");
  const values: Record<string, string> = {};
  for (const key of formData.keys()) if (!key.startsWith("$ACTION")) values[key] = text(formData, key);
  const fieldErrors: Record<string, string> = {};

  const limit = (key: string, max: number) => {
    if ((values[key] ?? "").length > max) fieldErrors[key] = `Use ${max} characters or fewer.`;
  };
  limit("company_name", 150);
  limit("tagline", 200);
  limit("address", 400);
  limit("default_seo_title", 120);
  limit("default_seo_description", 320);

  const phone = (key: string) => {
    if (!values[key]) return null;
    const parsed = parsePhoneStrict(values[key], values[`${key}_country`] || "NG");
    if (!parsed.ok) {
      fieldErrors[key] = "Enter a valid phone number, with the country code for numbers outside Nigeria.";
      return null;
    }
    return parsed.e164;
  };
  const phonePrimary = phone("phone_primary");
  const phoneSecondary = phone("phone_secondary");
  const whatsapp = phone("whatsapp_number");

  const email = values.email_primary?.toLowerCase() ?? "";
  if (email && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    fieldErrors.email_primary = "Enter a valid email address.";
  }

  const mapEmbed = values.map_embed_url ?? "";
  if (mapEmbed && !/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed\?/.test(mapEmbed)) {
    fieldErrors.map_embed_url =
      "Paste the link from Google Maps → Share → Embed a map (it starts with https://www.google.com/maps/embed?).";
  }

  // One line per entry: "Monday to Friday: 9am to 5pm".
  const hours = (values.business_hours ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (hours.length > 10) fieldErrors.business_hours = "Use at most 10 lines.";
  if (hours.some((line) => line.length > 80)) fieldErrors.business_hours = "Keep each line under 80 characters.";

  const social: Record<string, string> = {};
  for (const network of SOCIAL_NETWORKS) {
    const raw = values[`social_${network.key}`];
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || !network.host.test(url.hostname.toLowerCase()))
        throw new Error();
      social[network.key] = url.toString();
    } catch {
      fieldErrors[`social_${network.key}`] = `Paste the full https:// link to your ${network.label} page.`;
    }
  }

  if (Object.keys(fieldErrors).length) {
    return { status: "error", fieldErrors, values, message: "Check the highlighted fields." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      company_name: values.company_name || null,
      tagline: values.tagline || null,
      phone_primary: phonePrimary,
      phone_secondary: phoneSecondary,
      whatsapp_number: whatsapp,
      email_primary: email || null,
      address: values.address || null,
      map_embed_url: mapEmbed || null,
      business_hours: hours,
      social_links: social,
      default_seo_title: values.default_seo_title || null,
      default_seo_description: values.default_seo_description || null,
    })
    .eq("id", 1);
  if (error) return { status: "error", message: dbErrorMessage(error), values };

  await supabase.rpc("log_activity", { p_action: "settings.updated", p_entity_type: "site_settings" });
  updateTag(CONTENT_TAG);
  refresh();
  return { status: "success", message: "Settings saved. The website is updated." };
}
