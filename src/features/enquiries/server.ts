import "server-only";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { serverEnv } from "@/lib/env/server";

/**
 * Server-side checks for public forms: authoritative phone validation (full metadata) and
 * Cloudflare Turnstile verification. Both fail closed.
 */
export function parsePhoneStrict(input: string, country: string): { ok: true; e164: string } | { ok: false } {
  const value = input.trim();
  if (!value || value.length > 30 || !/^[+\d\s().-]+$/.test(value)) return { ok: false };
  const parsed = parsePhoneNumberFromString(value, (/^[A-Z]{2}$/.test(country) ? country : "NG") as CountryCode);
  return parsed?.isValid() ? { ok: true, e164: parsed.number } : { ok: false };
}

const TEST_SECRET_PREFIX = "1x0000000000000000000000000000000";

export async function verifyTurnstile(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const secret = serverEnv("TURNSTILE_SECRET_KEY");
  if (process.env.VERCEL_ENV === "production" && secret.startsWith(TEST_SECRET_PREFIX)) {
    throw new Error("Turnstile test keys must not be used in production.");
  }
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
