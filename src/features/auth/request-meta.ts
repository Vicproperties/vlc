import "server-only";
import { headers } from "next/headers";
import { ipHash } from "./crypto";

export interface RequestMeta {
  /** Keyed hash of the client IP: raw addresses are never stored. */
  ipHash: string;
  userAgent: string | null;
}

/**
 * Client details for rate limiting and security logs. On Vercel the platform sets
 * `x-forwarded-for` (client-supplied values are overwritten), so its first entry is the
 * client address. Elsewhere it falls back to `x-real-ip`, then a shared "unknown" bucket.
 */
export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim() || "unknown";
  return { ipHash: ipHash(ip), userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
}
