/**
 * Fixed option lists for property forms, filters and imports. Values match the database
 * enums / check constraints (migrations 0001, 0015).
 */

/** Nigeria's 36 states and the Federal Capital Territory (must match private.nigerian_states()). */
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;
export type NigerianState = (typeof NIGERIAN_STATES)[number];

/** Accepts common spellings in imports ("FCT", "Abuja", any letter case). */
export function matchNigerianState(input: string): NigerianState | null {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/\s+state$/, "");
  if (["fct", "abuja", "fct abuja", "fct, abuja"].includes(value)) return "Federal Capital Territory";
  return NIGERIAN_STATES.find((state) => state.toLowerCase() === value) ?? null;
}

export const PROPERTY_KINDS = ["land", "building"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export const PURPOSES = ["sale", "rent", "lease"] as const;
export type Purpose = (typeof PURPOSES)[number];
export const PURPOSE_LABELS: Record<Purpose, string> = { sale: "For sale", rent: "For rent", lease: "For lease" };

export const LAND_USES = ["residential", "commercial", "agricultural"] as const;
export type LandUse = (typeof LAND_USES)[number];
export const LAND_USE_LABELS: Record<LandUse, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
};

export const PROPERTY_STATUSES = ["draft", "published", "unavailable", "archived"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Draft",
  published: "Published",
  unavailable: "Unavailable",
  archived: "Archived",
};

export const PRICE_PERIOD_LABELS = { per_week: "Per week", per_month: "Per month", per_year: "Per year" } as const;
