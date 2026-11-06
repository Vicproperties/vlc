/**
 * Cookie consent, shared by the browser and the server. The choice is stored in one
 * first-party cookie, "vl_consent", as "<policy version>.<analytics 1|0>.<anonymous id>".
 * Nothing optional runs until the visitor has chosen; changing the policy version in the
 * dashboard asks everyone again.
 */
export const CONSENT_COOKIE = "vl_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 months

export interface Consent {
  version: string;
  analytics: boolean;
  anonId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  const [version, analytics, anonId] = decodeURIComponent(value).split(".");
  if (!version || version.length > 20 || !["0", "1"].includes(analytics) || !UUID.test(anonId ?? "")) return null;
  return { version, analytics: analytics === "1", anonId };
}

export function formatConsent(consent: Consent): string {
  return encodeURIComponent(`${consent.version}.${consent.analytics ? "1" : "0"}.${consent.anonId}`);
}

export const DEFAULT_NOTICE =
  "We use essential cookies to make this website work, for example to keep you signed in. With your permission we also count visits anonymously, so we can see which pages and properties are useful. We never sell your data.";
export const DEFAULT_ANALYTICS_DESCRIPTION =
  "Anonymous visit statistics: pages and properties viewed, how you found us, device type and country. No names, emails or IP addresses are stored.";
