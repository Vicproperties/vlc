import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Visitor statistics for the dashboard, read through the admin's own session (RLS requires
 * analytics:view). Totals are computed here from raw rows, which is fine at this site's
 * volume; a daily rollup can replace it if traffic grows (analytics_daily exists for that).
 */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export interface Ranked {
  label: string;
  value: number;
  href?: string;
}

export interface AnalyticsSummary {
  visitors: number;
  pageViews: number;
  propertyViews: number;
  whatsappClicks: number;
  phoneClicks: number;
  activeNow: number;
  daily: Array<{ day: string; visitors: number; pageViews: number }>;
  pages: Ranked[];
  properties: Ranked[];
  sources: Ranked[];
  devices: Ranked[];
  countries: Ranked[];
  referrers: Ranked[];
  truncated: boolean;
}

const ROW_LIMIT = 50_000;
const SOURCE_LABEL: Record<string, string> = {
  direct: "Direct (typed or bookmarked)",
  search: "Search engines",
  social: "Social media",
  referral: "Other websites",
  campaign: "Campaign links (UTM)",
  other: "Other",
};
const DEVICE_LABEL: Record<string, string> = { desktop: "Computer", mobile: "Phone", tablet: "Tablet", other: "Other" };

function rank(counts: Map<string, number>, limit: number, label: (key: string) => string = (k) => k): Ranked[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ label: label(key), value }));
}

function count(map: Map<string, number>, key: string | null | undefined) {
  const k = key || "Unknown";
  map.set(k, (map.get(k) ?? 0) + 1);
}

/** Lagos calendar day (UTC+1) of a timestamp. */
function lagosDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 10);
}

export async function analyticsSummary(days: Period): Promise<AnalyticsSummary> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const activeSince = new Date(Date.now() - 5 * 60_000).toISOString();

  const [sessions, events, active] = await Promise.all([
    supabase
      .from("analytics_sessions")
      .select("started_at, source, device_type, country, referrer_host")
      .gte("started_at", since)
      .limit(ROW_LIMIT),
    supabase
      .from("analytics_events")
      .select("type, path, property_id, created_at")
      .gte("created_at", since)
      .limit(ROW_LIMIT),
    supabase.from("analytics_sessions").select("id", { count: "exact", head: true }).gte("last_seen_at", activeSince),
  ]);
  if (sessions.error || events.error) throw new Error("Unable to load visitor statistics.");

  const daily = new Map<string, { visitors: number; pageViews: number }>();
  for (let i = days - 1; i >= 0; i--) {
    daily.set(lagosDay(new Date(Date.now() - i * 86_400_000).toISOString()), { visitors: 0, pageViews: 0 });
  }
  const sources = new Map<string, number>();
  const devices = new Map<string, number>();
  const countries = new Map<string, number>();
  const referrers = new Map<string, number>();
  for (const s of sessions.data) {
    const d = daily.get(lagosDay(s.started_at));
    if (d) d.visitors += 1;
    count(sources, s.source);
    count(devices, s.device_type);
    count(countries, s.country);
    if (s.referrer_host) count(referrers, s.referrer_host);
  }

  let pageViews = 0;
  let propertyViews = 0;
  let whatsappClicks = 0;
  let phoneClicks = 0;
  const pages = new Map<string, number>();
  const props = new Map<string, number>();
  for (const e of events.data) {
    if (e.type === "page_view") {
      pageViews += 1;
      count(pages, e.path);
      const d = daily.get(lagosDay(e.created_at));
      if (d) d.pageViews += 1;
    } else if (e.type === "property_view") {
      propertyViews += 1;
      if (e.property_id) count(props, e.property_id);
    } else if (e.type === "whatsapp_click") whatsappClicks += 1;
    else if (e.type === "phone_click") phoneClicks += 1;
  }

  const topProps = rank(props, 10);
  let properties: Ranked[] = [];
  if (topProps.length) {
    // Titles only, server-side: analytics staff may not have access to property records.
    const { data } = await createServiceClient()
      .from("properties")
      .select("id, title, slug")
      .in(
        "id",
        topProps.map((p) => p.label),
      );
    const byId = new Map((data ?? []).map((p) => [p.id, p]));
    properties = topProps.map((p) => {
      const property = byId.get(p.label);
      return {
        label: property?.title ?? "Deleted property",
        value: p.value,
        href: property ? `/properties/${property.slug}` : undefined,
      };
    });
  }

  return {
    visitors: sessions.data.length,
    pageViews,
    propertyViews,
    whatsappClicks,
    phoneClicks,
    activeNow: active.count ?? 0,
    daily: [...daily.entries()].map(([day, v]) => ({ day, ...v })),
    pages: rank(pages, 10).map((p) => ({ ...p, href: p.label })),
    properties,
    sources: rank(sources, 6, (k) => SOURCE_LABEL[k] ?? k),
    devices: rank(devices, 4, (k) => DEVICE_LABEL[k] ?? k),
    countries: rank(countries, 10),
    referrers: rank(referrers, 10),
    truncated: sessions.data.length >= ROW_LIMIT || events.data.length >= ROW_LIMIT,
  };
}

/** Visitors in the last 7 days, for the Overview page. */
export async function visitorsLastWeek(): Promise<number> {
  const supabase = await createClient();
  const { count: n } = await supabase
    .from("analytics_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  return n ?? 0;
}
