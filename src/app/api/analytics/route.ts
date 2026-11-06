import { cookies, headers } from "next/headers";
import { ipHash } from "@/features/auth/crypto";
import { withinRateLimit } from "@/features/auth/security-log";
import { CONSENT_COOKIE, parseConsent } from "@/features/cookies/consent";
import { getCookieSettings } from "@/features/cookies/queries";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * First-party visit statistics. Recorded ONLY when the visitor's own consent cookie says yes
 * for the current policy version and analytics is switched on in the dashboard. No IP address,
 * name or email is stored: just the page, how the visit started, device type and country.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["page_view", "whatsapp_click", "phone_click"]);
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|lighthouse/i;
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia)\./i;
const SOCIAL =
  /(^|\.)(facebook|fb|instagram|t|twitter|x|linkedin|whatsapp|wa|tiktok|youtube|pinterest|threads)\.(com|co|me|net)$/i;

function clip(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length ? value.slice(0, max) : null;
}

function device(ua: string): "desktop" | "mobile" | "tablet" | "other" {
  if (/ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

function browser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

function decodeHeader(value: string | null, max: number): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, max);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  const settings = await getCookieSettings();
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  if (!settings.analyticsEnabled || !consent?.analytics || consent.version !== settings.policyVersion) return done;

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return done;

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return done;
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return done;
  }
  const sessionId = typeof body.sid === "string" && UUID.test(body.sid) ? body.sid : null;
  const type = typeof body.type === "string" && TYPES.has(body.type) ? body.type : null;
  const path = clip(body.path, 500);
  if (!sessionId || !type || !path?.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api"))
    return done;

  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!(await withinRateLimit(`analytics:ip:${ipHash(ip)}`, [300, 600]))) return done;

  const service = createServiceClient();
  let propertyId: string | null = null;
  const propertyMatch = /^\/properties\/([a-z0-9-]{1,150})$/.exec(path.split("?")[0]);
  if (propertyMatch) {
    const { data } = await service
      .from("properties")
      .select("id")
      .eq("slug", propertyMatch[1])
      .eq("status", "published")
      .maybeSingle();
    propertyId = data?.id ?? null;
  }

  const now = new Date().toISOString();
  const { data: existing } = await service.from("analytics_sessions").select("id").eq("id", sessionId).maybeSingle();
  if (existing) {
    await service
      .from("analytics_sessions")
      .update({ last_seen_at: now, current_path: path, current_property_id: propertyId })
      .eq("id", sessionId);
  } else {
    const site = new URL(request.url).host;
    let referrerHost: string | null = null;
    try {
      const ref = clip(body.ref, 1000);
      if (ref) referrerHost = new URL(ref).host.toLowerCase().replace(/^www\./, "") || null;
    } catch {
      referrerHost = null;
    }
    if (referrerHost === site.replace(/^www\./, "")) referrerHost = null;
    const utm = (body.utm ?? {}) as Record<string, unknown>;
    const utmSource = clip(utm.source, 100);
    const source = utmSource
      ? "campaign"
      : !referrerHost
        ? "direct"
        : SEARCH.test(referrerHost)
          ? "search"
          : SOCIAL.test(referrerHost)
            ? "social"
            : "referral";
    await service.from("analytics_sessions").insert({
      id: sessionId,
      started_at: now,
      last_seen_at: now,
      device_type: device(ua),
      browser_family: browser(ua),
      country: clip(h.get("x-vercel-ip-country"), 2),
      region: decodeHeader(h.get("x-vercel-ip-country-region"), 100),
      city: decodeHeader(h.get("x-vercel-ip-city"), 100),
      referrer_host: referrerHost ? referrerHost.slice(0, 255) : null,
      source,
      utm_source: utmSource,
      utm_medium: clip(utm.medium, 100),
      utm_campaign: clip(utm.campaign, 100),
      landing_path: path,
      current_path: path,
      current_property_id: propertyId,
    });
  }

  const events: Array<{ session_id: string; type: string; path: string; property_id: string | null }> = [
    { session_id: sessionId, type, path, property_id: propertyId },
  ];
  if (type === "page_view" && propertyId)
    events.push({ session_id: sessionId, type: "property_view", path, property_id: propertyId });
  await service.from("analytics_events").insert(events as never);
  return done;
}
