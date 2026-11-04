/**
 * Browser-side photo preparation: decodes the photo (respecting camera orientation),
 * scales it to at most `maxEdge` pixels and re-encodes it. Re-encoding through a canvas
 * also drops embedded metadata such as GPS location. The server processes the result again,
 * so this step exists for upload speed on mobile data and the hosting request limit.
 */
export async function prepareImageForUpload(file: File, maxEdge: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format cannot be read here. Use a JPEG, PNG or WebP photo.");
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare photos for upload.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  // WebP where supported; some browsers (older Safari) fall back to PNG, so use JPEG there.
  const webp = await encode("image/webp", 0.86);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.86);
  if (!jpeg) throw new Error("The photo could not be prepared for upload.");
  return jpeg;
}
