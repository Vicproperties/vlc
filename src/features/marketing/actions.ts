"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { LISTINGS_TAG, MARKETING_TAG } from "@/features/listings/tags";
import { ACCEPTED_IMAGE_TYPES, reencodePhoto } from "@/lib/images";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Marketing (module "marketing"): top banner, announcement pop-up and property promotions.
 * Banner and announcement writes go through the admin's own session, so RLS enforces the
 * same permission again. Every change clears the public marketing cache.
 */
export interface MarketingFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface MarketingResult {
  ok: boolean;
  message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string, max = 5000): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

/** <input type="datetime-local"> values are Lagos time (UTC+1, no daylight saving). */
function lagosTime(value: string): string | null | false {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(`${value}:00+01:00`);
  return Number.isNaN(date.getTime()) ? false : date.toISOString();
}

/** Internal path ("/properties") or https:// link. */
function link(value: string): string | null | false {
  if (!value) return null;
  if (/^\/(?![/\\])/.test(value)) return value.length <= 1000 ? value : false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && value.length <= 1000 ? url.toString() : false;
  } catch {
    return false;
  }
}

function schedule(formData: FormData, fieldErrors: Record<string, string>) {
  const startsAt = lagosTime(text(formData, "starts_at", 20));
  const endsAt = lagosTime(text(formData, "ends_at", 20));
  if (startsAt === false) fieldErrors.starts_at = "Enter a valid date and time.";
  if (endsAt === false) fieldErrors.ends_at = "Enter a valid date and time.";
  if (startsAt && endsAt && endsAt <= startsAt) fieldErrors.ends_at = "The end must be after the start.";
  return { starts_at: startsAt || null, ends_at: endsAt || null };
}

function published() {
  updateTag(MARKETING_TAG);
  refresh();
}

// ---------------------------------------------------------------------------
// Top banner
// ---------------------------------------------------------------------------
export async function saveBannerAction(
  id: string | null,
  _prev: MarketingFormState,
  formData: FormData,
): Promise<MarketingFormState> {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", id ? "edit" : "create");

  const fieldErrors: Record<string, string> = {};
  const message = text(formData, "message", 400);
  if (message.length < 2 || message.length > 200) fieldErrors.message = "Write 2 to 200 characters.";
  const type = text(formData, "type", 20);
  if (!["information", "promotion", "notice"].includes(type)) fieldErrors.type = "Choose a type.";
  const linkUrl = link(text(formData, "link_url", 1100));
  if (linkUrl === false) fieldErrors.link_url = "Use a page on this site (starting with /) or a full https:// link.";
  const ctaLabel = text(formData, "cta_label", 80);
  if (ctaLabel.length > 40) fieldErrors.cta_label = "Use 40 characters or fewer.";
  if (ctaLabel && !linkUrl) fieldErrors.link_url = "Add the link for the button.";
  const times = schedule(formData, fieldErrors);
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const row = {
    message,
    type: type as "information" | "promotion" | "notice",
    link_url: linkUrl || null,
    cta_label: ctaLabel || null,
    ...times,
    is_active: formData.get("is_active") === "on",
  };
  const supabase = await createClient();
  let savedId = id;
  if (id) {
    const { error } = await supabase.from("top_banners").update(row).eq("id", id);
    if (error) return { status: "error", message: dbErrorMessage(error) };
  } else {
    const { data, error } = await supabase.from("top_banners").insert(row).select("id").single();
    if (error) return { status: "error", message: dbErrorMessage(error) };
    savedId = data.id;
  }
  if (row.is_active && savedId) {
    // One banner at a time: switching one on switches the others off.
    await supabase.from("top_banners").update({ is_active: false }).eq("is_active", true).neq("id", savedId);
  }
  await supabase.rpc("log_activity", {
    p_action: id ? "marketing.banner_updated" : "marketing.banner_created",
    p_entity_type: "top_banner",
    p_entity_id: id ?? undefined,
  });
  published();
  return { status: "success", message: id ? "Banner saved." : "Banner added." };
}

export async function setBannerActiveAction(id: string, active: boolean): Promise<MarketingResult> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", "edit");
  const supabase = await createClient();
  if (active) await supabase.from("top_banners").update({ is_active: false }).eq("is_active", true).neq("id", id);
  const { error } = await supabase.from("top_banners").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  published();
  return { ok: true, message: active ? "The banner is switched on." : "The banner is switched off." };
}

export async function deleteBannerAction(id: string): Promise<MarketingResult> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("top_banners").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: "marketing.banner_deleted",
    p_entity_type: "top_banner",
    p_entity_id: id,
  });
  published();
  return { ok: true, message: "Banner deleted." };
}

// ---------------------------------------------------------------------------
// Announcement pop-up
// ---------------------------------------------------------------------------
export async function saveAnnouncementAction(
  id: string | null,
  _prev: MarketingFormState,
  formData: FormData,
): Promise<MarketingFormState> {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", id ? "edit" : "create");

  const fieldErrors: Record<string, string> = {};
  const heading = text(formData, "heading", 300);
  if (heading.length < 2 || heading.length > 150) fieldErrors.heading = "Write 2 to 150 characters.";
  const message = text(formData, "message", 4000);
  if (message.length > 2000) fieldErrors.message = "Use 2,000 characters or fewer.";
  const ctaLabel = text(formData, "cta_label", 80);
  const ctaUrl = link(text(formData, "cta_url", 1100));
  if (ctaLabel.length > 40) fieldErrors.cta_label = "Use 40 characters or fewer.";
  if (ctaUrl === false) fieldErrors.cta_url = "Use a page on this site (starting with /) or a full https:// link.";
  if (ctaLabel && !ctaUrl) fieldErrors.cta_url = "Add the link for the button.";
  if (!ctaLabel && ctaUrl) fieldErrors.cta_label = "Add the button text.";
  const frequency = text(formData, "frequency", 30);
  if (!["once", "once_per_days", "once_per_session"].includes(frequency)) fieldErrors.frequency = "Choose how often.";
  const days = Number(text(formData, "frequency_days", 5) || "0");
  if (frequency === "once_per_days" && !(Number.isInteger(days) && days >= 1 && days <= 365)) {
    fieldErrors.frequency_days = "Enter a number of days from 1 to 365.";
  }
  const priority = Number(text(formData, "priority", 5) || "0");
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) fieldErrors.priority = "Enter 0 to 100.";
  const imageAlt = text(formData, "image_alt", 400);
  if (imageAlt.length > 300) fieldErrors.image_alt = "Use 300 characters or fewer.";
  const times = schedule(formData, fieldErrors);

  const image = formData.get("image");
  const hasImage = image instanceof File && image.size > 0;
  if (hasImage) {
    if (image.size > 3.5 * 1024 * 1024) fieldErrors.image = "This image is too large.";
    else if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(image.type))
      fieldErrors.image = "Use a JPEG, PNG or WebP image.";
    else if (!imageAlt) fieldErrors.image_alt = "Describe the image for people who cannot see it.";
  }
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const service = createServiceClient();
  let imagePath: string | undefined;
  if (hasImage) {
    const encoded = await reencodePhoto(image, 1600);
    if (!encoded) return { status: "error", fieldErrors: { image: "This file could not be read as an image." } };
    imagePath = `announcements/${randomUUID()}.webp`;
    // Marketing admins may lack website-content rights on this bucket: upload with the
    // service role, only after the marketing permission check above.
    const upload = await service.storage
      .from("site-media")
      .upload(imagePath, encoded.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (upload.error) return { status: "error", message: "The image could not be stored. Please try again." };
  }

  let oldImage: string | null = null;
  let version = 1;
  if (id) {
    const { data } = await supabase.from("announcements").select("image_path, version").eq("id", id).maybeSingle();
    oldImage = data?.image_path ?? null;
    version = (data?.version ?? 0) + 1;
  }
  const removeImage = formData.get("remove_image") === "on";
  const row = {
    heading,
    message: message || null,
    image_alt: imageAlt || null,
    cta_label: ctaLabel || null,
    cta_url: ctaUrl || null,
    frequency: frequency as "once" | "once_per_days" | "once_per_session",
    frequency_days: frequency === "once_per_days" ? days : null,
    priority,
    ...times,
    is_active: formData.get("is_active") === "on",
    // A new version is shown again to visitors who closed the previous one.
    version,
    ...(imagePath ? { image_path: imagePath } : removeImage ? { image_path: null } : {}),
  };
  const result = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert(row);
  if (result.error) {
    if (imagePath) await service.storage.from("site-media").remove([imagePath]);
    return { status: "error", message: dbErrorMessage(result.error) };
  }
  if (oldImage && (imagePath || removeImage)) await service.storage.from("site-media").remove([oldImage]);

  await supabase.rpc("log_activity", {
    p_action: id ? "marketing.announcement_updated" : "marketing.announcement_created",
    p_entity_type: "announcement",
    p_entity_id: id ?? undefined,
  });
  published();
  return { status: "success", message: id ? "Announcement saved." : "Announcement added." };
}

export async function setAnnouncementActiveAction(id: string, active: boolean): Promise<MarketingResult> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  published();
  return { ok: true, message: active ? "The announcement is switched on." : "The announcement is switched off." };
}

export async function deleteAnnouncementAction(id: string): Promise<MarketingResult> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", "delete");
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (data?.image_path) await createServiceClient().storage.from("site-media").remove([data.image_path]);
  await supabase.rpc("log_activity", {
    p_action: "marketing.announcement_deleted",
    p_entity_type: "announcement",
    p_entity_id: id,
  });
  published();
  return { ok: true, message: "Announcement deleted." };
}

// ---------------------------------------------------------------------------
// Property promotions
// ---------------------------------------------------------------------------
/**
 * Switches a property's promotion (strike-through regular price + discount) on or off.
 * Only this one column changes, with the service role after the marketing permission check,
 * so marketing staff do not need full property editing rights.
 */
export async function setPromotionAction(propertyId: string, active: boolean): Promise<MarketingResult> {
  if (!UUID.test(propertyId)) throw new Error("Invalid id.");
  await requireAdminPermission("marketing", "edit");
  const service = createServiceClient();
  const { data: property } = await service
    .from("properties")
    .select("regular_price, sales_price")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return { ok: false, message: "This property no longer exists." };
  if (active && !(property.regular_price && property.sales_price && property.sales_price < property.regular_price)) {
    return {
      ok: false,
      message: "A promotion needs a sales price lower than the regular price. Edit the property first.",
    };
  }
  const { error } = await service.from("properties").update({ promotion_active: active }).eq("id", propertyId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const supabase = await createClient();
  await supabase.rpc("log_activity", {
    p_action: active ? "marketing.promotion_on" : "marketing.promotion_off",
    p_entity_type: "property",
    p_entity_id: propertyId,
  });
  updateTag(LISTINGS_TAG);
  refresh();
  return { ok: true, message: active ? "Promotion switched on." : "Promotion switched off." };
}
