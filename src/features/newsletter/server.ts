import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";

/** Confirmation tokens are random; only their SHA-256 hash is stored. */
export function newConfirmToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Unsubscribe links are signed with the server secret instead of stored, so any future email
 * can carry a working link without keeping raw tokens in the database.
 */
export function unsubscribeSignature(subscriberId: string): string {
  return createHmac("sha256", serverEnv("ADMIN_OTP_HMAC_SECRET"))
    .update(`newsletter-unsubscribe:${subscriberId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function validUnsubscribeSignature(subscriberId: string, signature: string): boolean {
  const expected = Buffer.from(unsubscribeSignature(subscriberId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function newsletterLinks(subscriberId: string, token: string) {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  return {
    confirm: `${site}/newsletter/confirm?token=${encodeURIComponent(token)}`,
    unsubscribe: `${site}/newsletter/unsubscribe?id=${subscriberId}&sig=${unsubscribeSignature(subscriberId)}`,
  };
}
