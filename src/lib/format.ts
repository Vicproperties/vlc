/**
 * Display formatting helpers. Pure functions — safe on server and client.
 */

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

/** Format a whole-naira amount, e.g. 25000000 -> "₦25,000,000". */
export function formatNaira(amount: number): string {
  return nairaFormatter.format(Math.round(amount));
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export const PRICE_PERIODS = ["per_week", "per_month", "per_year"] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];

const PRICE_PERIOD_LABELS: Record<PricePeriod, string> = {
  per_week: "per week",
  per_month: "per month",
  per_year: "per year",
};

export function formatPricePeriod(period: PricePeriod): string {
  return PRICE_PERIOD_LABELS[period];
}

export const LAND_SIZE_UNITS = ["sqm", "plot", "acre", "hectare"] as const;
export type LandSizeUnit = (typeof LAND_SIZE_UNITS)[number];

/** Labels used in admin dropdowns. */
export const LAND_SIZE_UNIT_OPTIONS: ReadonlyArray<{ value: LandSizeUnit; label: string }> = [
  { value: "sqm", label: "Square Metres (sqm)" },
  { value: "plot", label: "Plots" },
  { value: "acre", label: "Acres" },
  { value: "hectare", label: "Hectares" },
];

const UNIT_SINGULAR: Record<LandSizeUnit, string> = {
  sqm: "sqm",
  plot: "plot",
  acre: "acre",
  hectare: "hectare",
};

const UNIT_PLURAL: Record<LandSizeUnit, string> = {
  sqm: "sqm",
  plot: "plots",
  acre: "acres",
  hectare: "hectares",
};

/** Public display of a land size, e.g. (500, "sqm") -> "500 sqm", (2, "plot") -> "2 plots". */
export function formatLandSize(size: number, unit: LandSizeUnit): string {
  const label = size === 1 ? UNIT_SINGULAR[unit] : UNIT_PLURAL[unit];
  return `${formatNumber(size)} ${label}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

export function formatDate(value: Date | string): string {
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** ISO timestamp `days` days before now (for "last N days" queries). */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
