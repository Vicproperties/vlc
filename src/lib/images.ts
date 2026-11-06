import "server-only";
import sharp from "sharp";

/**
 * Re-encodes an uploaded photo: decodes with a pixel limit, applies the camera orientation,
 * fits it within `maxEdge` pixels, writes WebP and drops all metadata (EXIF, GPS location,
 * camera details). Owner decision 2026-11-04. Returns null if the file is not a readable image.
 */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export async function reencodePhoto(
  file: File,
  maxEdge: number,
): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 60_000_000,
      failOn: "error",
    })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    // Logged (no file contents) so a failure on the server is visible in the hosting logs.
    console.error(`[images] re-encode failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Public URL of an object in a public Storage bucket. */
export function publicStorageUrl(bucket: "property-media" | "site-media" | "blog-media", path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
