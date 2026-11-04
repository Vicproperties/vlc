/**
 * Parsing and validation for links admins paste into property forms.
 * Pure functions: shared by forms (live feedback), Server Actions and CSV import.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the 11-character video id from any common YouTube URL form, or accepts a bare
 * id. Returns null for anything else (including non-YouTube hosts).
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (YOUTUBE_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");

  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [, first, second] = url.pathname.split("/");
      if (["embed", "shorts", "live", "v"].includes(first ?? "")) id = second ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/**
 * Accepts only HTTPS Google Maps links (full and short forms). Returns the normalised URL
 * or null. Other hosts are rejected so the public site never links to arbitrary sites.
 */
export function parseGoogleMapsUrl(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const isGoogleMaps =
    ((host === "www.google.com" || host === "google.com" || /^www\.google\.[a-z.]{2,6}$/.test(host)) &&
      url.pathname.startsWith("/maps")) ||
    host === "maps.google.com" ||
    host === "maps.app.goo.gl" ||
    (host === "goo.gl" && url.pathname.startsWith("/maps"));
  return isGoogleMaps ? url.toString() : null;
}

/**
 * Parses a whole-naira amount typed by a person: "25,000,000", "₦25000000", "25 000 000".
 * Returns null for empty input, NaN for invalid input (so callers can tell them apart).
 */
export function parseNaira(input: string): number | null {
  const value = input.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (!value) return null;
  if (!/^\d{1,14}$/.test(value)) return Number.NaN;
  return Number(value);
}
