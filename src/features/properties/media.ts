import { publicEnv } from "@/lib/env/client";

/** Public URL of an object in the (public) property-media bucket. */
export function propertyImageUrl(path: string): string {
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/property-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export const MAX_PHOTOS_PER_PROPERTY = 30;
/** Longest edge after processing (owner decision 2026-11-04). */
export const PHOTO_MAX_EDGE = 2400;
/** Largest file accepted by the server after browser-side resizing. */
export const PHOTO_MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
export const PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
