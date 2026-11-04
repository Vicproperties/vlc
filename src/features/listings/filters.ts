import { LAND_USE_LABELS, LAND_USES, NIGERIAN_STATES, PURPOSE_LABELS, PURPOSES } from "@/features/properties/options";
import { formatNaira } from "@/lib/format";

/**
 * Public property search state lives in the URL (shareable, crawlable, works without
 * JavaScript). Everything from the URL is untrusted: unknown values are dropped.
 */
export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export const AVAILABILITY = ["all", "available", "unavailable"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export interface ListingFilters {
  q: string;
  kind: "land" | "building" | null;
  purpose: (typeof PURPOSES)[number] | null;
  state: (typeof NIGERIAN_STATES)[number] | null;
  landUse: (typeof LAND_USES)[number] | null;
  buildingType: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  availability: Availability;
  sort: Sort;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const pick = <T extends string>(values: readonly T[], value: string): T | null =>
  (values as readonly string[]).includes(value) ? (value as T) : null;
const amount = (value: string) => {
  const digits = value.replace(/[₦,\s]/g, "");
  return /^\d{1,14}$/.test(digits) ? Number(digits) : null;
};

export function parseListingFilters(params: Params): ListingFilters {
  const bedrooms = Number.parseInt(first(params.bedrooms), 10);
  const page = Number.parseInt(first(params.page), 10);
  let minPrice = amount(first(params.min_price));
  let maxPrice = amount(first(params.max_price));
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  const kind = pick(["land", "building"] as const, first(params.kind));

  return {
    q: first(params.q).trim().replace(/\s+/g, " ").slice(0, 100),
    kind,
    purpose: pick(PURPOSES, first(params.purpose)),
    state: pick(NIGERIAN_STATES, first(params.state)),
    landUse: kind === "building" ? null : pick(LAND_USES, first(params.land_use)),
    buildingType: kind === "land" ? null : /^[a-z0-9-]{1,80}$/.test(first(params.type)) ? first(params.type) : null,
    minPrice,
    maxPrice,
    bedrooms: kind === "land" || !(bedrooms >= 1 && bedrooms <= 10) ? null : bedrooms,
    availability: pick(AVAILABILITY, first(params.availability)) ?? "all",
    sort: pick(SORTS, first(params.sort)) ?? "newest",
    page: page >= 1 && page <= 1000 ? page : 1,
  };
}

/** URL for these filters, with optional changes. Page resets to 1 unless set explicitly. */
export function listingsHref(filters: ListingFilters, changes: Partial<ListingFilters> = {}): string {
  const next = { ...filters, page: 1, ...changes };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.kind) query.set("kind", next.kind);
  if (next.purpose) query.set("purpose", next.purpose);
  if (next.state) query.set("state", next.state);
  if (next.landUse) query.set("land_use", next.landUse);
  if (next.buildingType) query.set("type", next.buildingType);
  if (next.minPrice !== null) query.set("min_price", String(next.minPrice));
  if (next.maxPrice !== null) query.set("max_price", String(next.maxPrice));
  if (next.bedrooms !== null) query.set("bedrooms", String(next.bedrooms));
  if (next.availability !== "all") query.set("availability", next.availability);
  if (next.sort !== "newest") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));
  const text = query.toString();
  return text ? `/properties?${text}` : "/properties";
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  return activeFilters(filters, new Map()).length > 0;
}

/** Removable descriptions of the active filters ("Lagos", "Up to ₦50,000,000", …). */
export function activeFilters(
  filters: ListingFilters,
  buildingTypeNames: Map<string, string>,
): Array<{ key: string; label: string; href: string }> {
  const items: Array<{ key: string; label: string; href: string }> = [];
  const add = (key: string, label: string, change: Partial<ListingFilters>) =>
    items.push({ key, label, href: listingsHref(filters, change) });

  if (filters.q) add("q", `“${filters.q}”`, { q: "" });
  if (filters.kind)
    add("kind", filters.kind === "land" ? "Land" : "Buildings", {
      kind: null,
      landUse: null,
      buildingType: null,
      bedrooms: null,
    });
  if (filters.purpose) add("purpose", PURPOSE_LABELS[filters.purpose], { purpose: null });
  if (filters.state) add("state", filters.state, { state: null });
  if (filters.landUse) add("land_use", LAND_USE_LABELS[filters.landUse], { landUse: null });
  if (filters.buildingType)
    add("type", buildingTypeNames.get(filters.buildingType) ?? filters.buildingType, { buildingType: null });
  if (filters.minPrice !== null) add("min_price", `From ${formatNaira(filters.minPrice)}`, { minPrice: null });
  if (filters.maxPrice !== null) add("max_price", `Up to ${formatNaira(filters.maxPrice)}`, { maxPrice: null });
  if (filters.bedrooms !== null) add("bedrooms", `${filters.bedrooms}+ bedrooms`, { bedrooms: null });
  if (filters.availability !== "all")
    add("availability", filters.availability === "available" ? "Available only" : "Unavailable only", {
      availability: "all",
    });
  return items;
}
