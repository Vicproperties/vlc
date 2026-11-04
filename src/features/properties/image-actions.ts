"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import sharp from "sharp";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { MAX_PHOTOS_PER_PROPERTY, PHOTO_ACCEPTED_TYPES, PHOTO_MAX_EDGE, PHOTO_MAX_UPLOAD_BYTES } from "./media";
import type { ActionResult } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(...ids: string[]) {
  for (const id of ids) if (!UUID.test(id)) throw new Error("Invalid id.");
}

function cleanAlt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const alt = value.replace(/\s+/g, " ").trim().slice(0, 300);
  return alt || null;
}

/**
 * Stores one photo. The browser has already resized it; the server still treats the file as
 * untrusted: it checks size and type, decodes it with a pixel limit, re-encodes it to WebP
 * (max 2400 px) and drops all metadata (EXIF, GPS location, camera details).
 */
export async function uploadPropertyImageAction(propertyId: string, formData: FormData): Promise<ActionResult> {
  assertUuid(propertyId);
  await requireAdminPermission("properties", "edit");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo to upload." };
  if (file.size > PHOTO_MAX_UPLOAD_BYTES)
    return { ok: false, message: "This photo is too large. Try a smaller photo." };
  if (!(PHOTO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Use a JPEG, PNG, WebP or AVIF photo." };
  }

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, images:property_images(id, sort_order)")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return { ok: false, message: "This property could not be found." };
  if (property.images.length >= MAX_PHOTOS_PER_PROPERTY) {
    return { ok: false, message: `A property can have at most ${MAX_PHOTOS_PER_PROPERTY} photos.` };
  }

  let output: { data: Buffer; info: sharp.OutputInfo };
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000, failOn: "error" })
      .rotate() // apply the camera orientation before metadata is dropped
      .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return { ok: false, message: "This file could not be read as a photo." };
  }

  const path = `${propertyId}/${randomUUID()}.webp`;
  const upload = await supabase.storage
    .from("property-media")
    .upload(path, output.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
  if (upload.error) return { ok: false, message: "The photo could not be stored. Please try again." };

  const nextOrder = property.images.reduce((max, image) => Math.max(max, image.sort_order), -1) + 1;
  const { error } = await supabase.from("property_images").insert({
    property_id: propertyId,
    storage_path: path,
    width: output.info.width,
    height: output.info.height,
    sort_order: nextOrder,
    is_cover: property.images.length === 0,
    alt_text: cleanAlt(formData.get("alt_text")),
  });
  if (error) {
    await supabase.storage.from("property-media").remove([path]);
    return { ok: false, message: dbErrorMessage(error) };
  }

  await supabase.rpc("log_activity", {
    p_action: "property.photo_added",
    p_entity_type: "property",
    p_entity_id: propertyId,
  });
  refresh();
  return { ok: true, message: "Photo added." };
}

export async function updateImageAltAction(propertyId: string, imageId: string, alt: string): Promise<ActionResult> {
  assertUuid(propertyId, imageId);
  await requireAdminPermission("properties", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("property_images")
    .update({ alt_text: cleanAlt(alt) })
    .eq("id", imageId)
    .eq("property_id", propertyId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Description saved." };
}

export async function setCoverImageAction(propertyId: string, imageId: string): Promise<ActionResult> {
  assertUuid(propertyId, imageId);
  await requireAdminPermission("properties", "edit");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_property_cover", { p_property_id: propertyId, p_image_id: imageId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Cover photo updated." };
}

export async function reorderImagesAction(propertyId: string, imageIds: string[]): Promise<ActionResult> {
  assertUuid(propertyId, ...imageIds);
  if (imageIds.length > MAX_PHOTOS_PER_PROPERTY) throw new Error("Too many ids.");
  await requireAdminPermission("properties", "edit");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_property_images", {
    p_property_id: propertyId,
    p_image_ids: imageIds,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Photo order saved." };
}

export async function deleteImageAction(propertyId: string, imageId: string): Promise<ActionResult> {
  assertUuid(propertyId, imageId);
  await requireAdminPermission("properties", "edit");
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("property_images")
    .select("storage_path, is_cover")
    .eq("id", imageId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!image) return { ok: false, message: "This photo no longer exists." };

  const { error } = await supabase.from("property_images").delete().eq("id", imageId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.storage.from("property-media").remove([image.storage_path]);

  if (image.is_cover) {
    const { data: next } = await supabase
      .from("property_images")
      .select("id")
      .eq("property_id", propertyId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (next) await supabase.rpc("set_property_cover", { p_property_id: propertyId, p_image_id: next.id });
  }

  await supabase.rpc("log_activity", {
    p_action: "property.photo_removed",
    p_entity_type: "property",
    p_entity_id: propertyId,
  });
  refresh();
  return { ok: true, message: "Photo removed." };
}
