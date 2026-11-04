import { createHmac, randomInt } from "node:crypto";
import { OTP_LENGTH } from "./constants";

/**
 * Pure crypto helpers (no environment access) so they can be unit tested.
 * Server code uses the wrappers in `crypto.ts`, which supply the secret.
 */

/** Uniformly random numeric code, e.g. "042917". */
export function generateOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

/**
 * HMAC of the code bound to one Auth session: a code (or its hash) is useless for any other
 * login, and the database never holds anything that reveals the code without the secret.
 */
export function hashOtp(secret: string, sessionId: string, code: string): string {
  return createHmac("sha256", secret).update(`otp:${sessionId}:${code}`).digest("hex");
}

/** Keyed hash for identifiers stored in security logs and rate-limit keys (emails, IPs). */
export function hashIdentifier(secret: string, kind: "email" | "ip", value: string): string {
  return createHmac("sha256", secret).update(`${kind}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}
