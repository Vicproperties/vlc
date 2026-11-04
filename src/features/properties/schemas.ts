import { z } from "zod";
import { LAND_SIZE_UNITS, PRICE_PERIODS } from "@/lib/format";
import { parseGoogleMapsUrl, parseNaira, parseYouTubeId } from "./links";
import { LAND_USES, NIGERIAN_STATES, PURPOSES, type PropertyKind } from "./options";

/**
 * Property input validation, shared by the dashboard forms and the CSV import so both apply
 * exactly the same rules. Input is a flat record of strings (FormData or a CSV row); output
 * is shaped like the database row. The database re-checks the structural rules (CHECK
 * constraints, triggers), so these checks exist to give clear messages, not as the only guard.
 *
 * `description_html` is NOT sanitised here (this module is environment-neutral); Server
 * Actions sanitise it with `sanitizeRichText()` before saving.
 */
export type RawInput = Record<string, string | undefined>;

const TRUE_VALUES = new Set(["on", "true", "yes", "y", "1"]);
const FALSE_VALUES = new Set(["", "off", "false", "no", "n", "0"]);

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => value || null);

const flag = (label: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => TRUE_VALUES.has(value) || FALSE_VALUES.has(value), `${label} must be yes or no.`)
    .transform((value) => TRUE_VALUES.has(value));

const naira = (label: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parseNaira(value);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({ code: "custom", message: `${label} must be a whole number of naira, e.g. 25,000,000.` });
      return z.NEVER;
    }
    if (parsed === 0) {
      ctx.addIssue({ code: "custom", message: `${label} must be more than zero.` });
      return z.NEVER;
    }
    return parsed;
  });

const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!/^\d+$/.test(value) || Number(value) > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number between 0 and ${max}.` });
        return z.NEVER;
      }
      return Number(value);
    });

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!(values as readonly string[]).includes(value)) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return value as T[number];
    });

const optionalUuid = (message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!z.uuid().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return value;
    });

const common = {
  title: z
    .string()
    .trim()
    .min(3, "Enter a title of at least 3 characters.")
    .max(200, "The title must be 200 characters or fewer."),
  purpose: z.enum(PURPOSES, { error: "Choose sale, rent or lease." }),
  description_html: z.string().max(100_000, "The description is too long."),
  address: text(300, "Address"),
  city: text(100, "City or area"),
  state: optionalEnum(NIGERIAN_STATES, "Choose a state from the list."),
  location_text: text(300, "Location"),
  google_maps_url: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const url = parseGoogleMapsUrl(value);
      if (!url) {
        ctx.addIssue({
          code: "custom",
          message: "Paste a Google Maps link (https://maps.app.goo.gl/… or google.com/maps/…).",
        });
        return z.NEVER;
      }
      return url;
    }),
  estate_id: optionalUuid("Choose an estate from the list."),
  title_documentation: text(300, "Title documentation"),
  features: z.string().transform((value, ctx) => {
    const items = value
      .split(/[\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const unique = [...new Set(items)];
    if (unique.length > 60) ctx.addIssue({ code: "custom", message: "Use at most 60 features." });
    if (unique.some((item) => item.length > 100))
      ctx.addIssue({ code: "custom", message: "Each feature must be 100 characters or fewer." });
    return unique;
  }),
  youtube_video_id: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const id = parseYouTubeId(value);
      if (!id) {
        ctx.addIssue({ code: "custom", message: "Paste a YouTube video link, e.g. https://youtu.be/…" });
        return z.NEVER;
      }
      return id;
    }),
  regular_price: naira("Regular price"),
  sales_price: naira("Sales price"),
  instalment_price: naira("Instalment price"),
  instalment_note: text(2000, "Instalment note"),
  price_period: optionalEnum(PRICE_PERIODS, "Choose per week, per month or per year."),
  promotion_active: flag("Promotion"),
  land_size: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const number = Number(value.replace(/,/g, ""));
      if (!/^\d+(\.\d{1,2})?$/.test(value.replace(/,/g, "")) || number <= 0 || number >= 10_000_000_000) {
        ctx.addIssue({ code: "custom", message: "Land size must be a positive number (up to 2 decimal places)." });
        return z.NEVER;
      }
      return number;
    }),
  land_size_unit: optionalEnum(LAND_SIZE_UNITS, "Choose a unit: sqm, plot, acre or hectare."),
  is_featured: flag("Featured"),
  featured_order: wholeNumber("Featured order", 9999),
  seo_title: text(120, "SEO title"),
  seo_description: text(320, "SEO description"),
};

const landSchema = z.object({
  ...common,
  land_use: optionalEnum(LAND_USES, "Choose residential, commercial or agricultural."),
  dimensions: text(120, "Dimensions"),
  available_plots: wholeNumber("Available plots", 1_000_000),
});

const buildingSchema = z.object({
  ...common,
  building_type_id: optionalUuid("Choose a building type from the list."),
  bedrooms: wholeNumber("Bedrooms", 100),
  bathrooms: wholeNumber("Bathrooms", 100),
  toilets: wholeNumber("Toilets", 100),
  parking_spaces: wholeNumber("Parking spaces", 500),
});

type Common = z.output<z.ZodObject<typeof common>>;
export type LandInput = z.output<typeof landSchema> & { kind: "land" };
export type BuildingInput = z.output<typeof buildingSchema> & { kind: "building" };
export type PropertyInput = LandInput | BuildingInput;

/** Field names accepted for each kind (used to build the form and the CSV templates). */
export const COMMON_FIELDS = Object.keys(common);
export const LAND_FIELDS = Object.keys(landSchema.shape);
export const BUILDING_FIELDS = Object.keys(buildingSchema.shape);

function crossFieldIssues(data: Common): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  if (data.price_period && data.purpose === "sale") {
    issues.push({ path: "price_period", message: "A payment period applies only to rent or lease." });
  }
  if ((data.land_size === null) !== (data.land_size_unit === null)) {
    issues.push({
      path: data.land_size === null ? "land_size" : "land_size_unit",
      message: "Enter both the land size and its unit, or neither.",
    });
  }
  if (data.promotion_active) {
    if (data.regular_price === null || data.sales_price === null) {
      issues.push({ path: "sales_price", message: "A promotion needs both a regular price and a sales price." });
    } else if (data.sales_price >= data.regular_price) {
      issues.push({
        path: "sales_price",
        message: "During a promotion the sales price must be lower than the regular price.",
      });
    }
  }
  if (data.is_featured === false && data.featured_order !== null) data.featured_order = null;
  return issues;
}

export type ParseResult = { ok: true; data: PropertyInput } | { ok: false; fieldErrors: Record<string, string> };

/** Fills absent keys with "" so FormData / CSV rows parse identically. */
function complete(raw: RawInput, fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) out[field] = raw[field] ?? "";
  return out;
}

export function parsePropertyInput(kind: PropertyKind, raw: RawInput): ParseResult {
  const fields = kind === "land" ? LAND_FIELDS : BUILDING_FIELDS;
  const schema = kind === "land" ? landSchema : buildingSchema;
  const result = schema.safeParse(complete(raw, fields));
  const fieldErrors: Record<string, string> = {};

  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, fieldErrors };
  }
  for (const issue of crossFieldIssues(result.data)) fieldErrors[issue.path] ??= issue.message;
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  return { ok: true, data: { ...result.data, kind } as PropertyInput };
}

/** Requirements before a property can be published (drafts may be incomplete). */
export function publishProblems(property: {
  regular_price: number | null;
  sales_price: number | null;
  state: string | null;
  location_text: string | null;
  city: string | null;
  description: string | null;
  imageCount: number;
}): string[] {
  const problems: string[] = [];
  if (property.regular_price === null && property.sales_price === null) problems.push("Add a price.");
  if (!property.state) problems.push("Choose the state.");
  if (!property.location_text && !property.city) problems.push("Add the location or city.");
  if (!property.description?.trim()) problems.push("Add a description.");
  if (property.imageCount < 1) problems.push("Add at least one photo.");
  return problems;
}
