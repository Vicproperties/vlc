"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { refresh, updateTag } from "next/cache";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { CONTENT_TAG } from "@/features/listings/tags";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Logo and browser-tab icon (Website Settings, "settings" edit permission). Every upload is
 * decoded and re-encoded on the server, which drops anything hidden in the file; SVG is not
 * accepted because it can carry scripts. Files go to the public site-media bucket.
 */
export interface BrandingState {
  status: "idle" | "error" | "success";
  message?: string;
}

type Kind = "logo" | "favicon";
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

async function encode(file: File, kind: Kind): Promise<Buffer | null> {
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
      failOn: "error",
    }).rotate();
    if (kind === "logo") {
      return await input
        .resize({ width: 800, height: 320, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 90, alphaQuality: 100 })
        .toBuffer();
    }
    return await input
      .resize({ width: 512, height: 512, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function column(kind: Kind): "logo_path" | "favicon_path" {
  return kind === "logo" ? "logo_path" : "favicon_path";
}

function patch(kind: Kind, value: string | null) {
  return kind === "logo" ? { logo_path: value } : { favicon_path: value };
}

export async function uploadBrandingAction(
  kind: Kind,
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  if (kind !== "logo" && kind !== "favicon") throw new Error("Invalid kind.");
  await requireAdminPermission("settings", "edit");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose an image first." };
  if (file.size > MAX_BYTES) return { status: "error", message: "This image is too large (3 MB maximum)." };
  if (!ACCEPTED.includes(file.type)) return { status: "error", message: "Use a PNG, JPEG or WebP image." };

  const data = await encode(file, kind);
  if (!data) return { status: "error", message: "This file could not be read as an image." };
  const path = `branding/${kind}-${randomUUID()}.${kind === "logo" ? "webp" : "png"}`;
  const service = createServiceClient();
  // Website Settings staff may lack website-content rights on this bucket: upload with the
  // service role, only after the settings permission check above.
  const upload = await service.storage.from("site-media").upload(path, data, {
    contentType: kind === "logo" ? "image/webp" : "image/png",
    upsert: false,
    cacheControl: "31536000",
  });
  if (upload.error) return { status: "error", message: "The image could not be stored. Please try again." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("site_settings").select("logo_path, favicon_path").eq("id", 1).single();
  const old = current?.[column(kind)] ?? null;
  const { error } = await supabase.from("site_settings").update(patch(kind, path)).eq("id", 1);
  if (error) {
    await service.storage.from("site-media").remove([path]);
    return { status: "error", message: dbErrorMessage(error) };
  }
  if (old) await service.storage.from("site-media").remove([old]);
  await supabase.rpc("log_activity", { p_action: `settings.${kind}_updated`, p_entity_type: "site_settings" });
  updateTag(CONTENT_TAG);
  refresh();
  return { status: "success", message: kind === "logo" ? "Logo updated." : "Browser icon updated." };
}

export async function removeBrandingAction(kind: Kind): Promise<BrandingState> {
  if (kind !== "logo" && kind !== "favicon") throw new Error("Invalid kind.");
  await requireAdminPermission("settings", "edit");
  const supabase = await createClient();
  const { data: current } = await supabase.from("site_settings").select("logo_path, favicon_path").eq("id", 1).single();
  const old = current?.[column(kind)] ?? null;
  const { error } = await supabase.from("site_settings").update(patch(kind, null)).eq("id", 1);
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (old) await createServiceClient().storage.from("site-media").remove([old]);
  await supabase.rpc("log_activity", { p_action: `settings.${kind}_removed`, p_entity_type: "site_settings" });
  updateTag(CONTENT_TAG);
  refresh();
  return { status: "success", message: kind === "logo" ? "Logo removed." : "Browser icon removed." };
}
