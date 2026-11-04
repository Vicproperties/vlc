import Papa from "papaparse";
import { plainToRichText } from "@/lib/plain-text";
import { matchNigerianState, type PropertyKind } from "../options";
import { parsePropertyInput, type PropertyInput, type RawInput } from "../schemas";

/**
 * CSV import parsing (pure: no database access, unit tested). Separate templates for land
 * and buildings (agreed Stage 1). Every row goes through the same validation as the
 * dashboard form, so an imported draft can always be opened and saved in the form.
 */
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** Column header -> form field. Headers are case-insensitive; spaces may replace underscores. */
const COMMON_COLUMNS: Record<string, string> = {
  title: "title",
  purpose: "purpose",
  description: "description_html",
  state: "state",
  city: "city",
  location: "location_text",
  address: "address",
  google_maps_link: "google_maps_url",
  estate: "estate_id",
  title_documentation: "title_documentation",
  features: "features",
  youtube_link: "youtube_video_id",
  regular_price: "regular_price",
  sales_price: "sales_price",
  instalment_price: "instalment_price",
  instalment_terms: "instalment_note",
  payment_period: "price_period",
  promotion_active: "promotion_active",
  land_size: "land_size",
  land_size_unit: "land_size_unit",
};

export const IMPORT_COLUMNS: Record<PropertyKind, Record<string, string>> = {
  land: { ...COMMON_COLUMNS, land_use: "land_use", dimensions: "dimensions", available_plots: "available_plots" },
  building: {
    ...COMMON_COLUMNS,
    building_type: "building_type_id",
    bedrooms: "bedrooms",
    bathrooms: "bathrooms",
    toilets: "toilets",
    parking_spaces: "parking_spaces",
  },
};

export const REQUIRED_COLUMNS = ["title", "purpose"] as const;

/** Header row for the downloadable template (UTF-8 BOM so Excel opens it correctly). */
export function templateCsv(kind: PropertyKind): string {
  return `﻿${Object.keys(IMPORT_COLUMNS[kind]).join(",")}\r\n`;
}

export interface ImportLookups {
  /** lower-cased estate name -> id (active estates only) */
  estates: Map<string, string>;
  /** lower-cased building type name or slug -> id (active types only) */
  buildingTypes: Map<string, string>;
}

export interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  input: PropertyInput | null;
  errors: string[];
  estateId: string | null;
  /** Another row in the same file looks like the same property. */
  sameFileAs: number | null;
}

export interface ParsedFile {
  headerErrors: string[];
  rows: ParsedRow[];
}

const normaliseHeader = (header: string) =>
  header
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

/** Spreadsheet formula prefixes: rejected so imported text can never run as a formula later. */
const FORMULA_START = /^[=+@\t\r]/;

const PERIOD_ALIASES: Record<string, string> = {
  per_week: "per_week",
  "per week": "per_week",
  weekly: "per_week",
  week: "per_week",
  per_month: "per_month",
  "per month": "per_month",
  monthly: "per_month",
  month: "per_month",
  per_year: "per_year",
  "per year": "per_year",
  "per annum": "per_year",
  yearly: "per_year",
  annually: "per_year",
  year: "per_year",
};

const UNIT_ALIASES: Record<string, string> = {
  sqm: "sqm",
  "sq m": "sqm",
  m2: "sqm",
  "square metres": "sqm",
  "square meters": "sqm",
  plot: "plot",
  plots: "plot",
  acre: "acre",
  acres: "acre",
  hectare: "hectare",
  hectares: "hectare",
  ha: "hectare",
};

const PURPOSE_ALIASES: Record<string, string> = {
  sale: "sale",
  "for sale": "sale",
  sell: "sale",
  rent: "rent",
  "for rent": "rent",
  lease: "lease",
  "for lease": "lease",
};

export function parseImportCsv(text: string, kind: PropertyKind, lookups: ImportLookups): ParsedFile {
  const columns = IMPORT_COLUMNS[kind];
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const [header = [], ...body] = result.data;
  const headers = header.map(normaliseHeader);
  const headerErrors: string[] = [];

  if (result.errors.some((error) => error.type === "Quotes")) {
    headerErrors.push("The file has a quotation mark problem. Re-save it as CSV from your spreadsheet program.");
  }
  const unknown = headers.filter((h) => h && !(h in columns));
  if (unknown.length) {
    headerErrors.push(
      `Unknown column(s): ${unknown.join(", ")}. ${kind === "land" ? "Use the land template." : "Use the building template."}`,
    );
  }
  const missing = REQUIRED_COLUMNS.filter((required) => !headers.includes(required));
  if (missing.length) headerErrors.push(`Missing required column(s): ${missing.join(", ")}.`);
  const repeated = headers.filter((h, i) => h && headers.indexOf(h) !== i);
  if (repeated.length) headerErrors.push(`Repeated column(s): ${[...new Set(repeated)].join(", ")}.`);
  if (body.length === 0) headerErrors.push("The file has no property rows.");
  if (body.length > MAX_IMPORT_ROWS) headerErrors.push(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  if (headerErrors.length) return { headerErrors, rows: [] };

  const seen = new Map<string, number>();
  const rows = body.map((cells, index): ParsedRow => {
    const rowNumber = index + 2; // spreadsheet row (header is row 1)
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) raw[h] = (cells[i] ?? "").trim();
    });
    const errors: string[] = [];

    if (cells.length > headers.length && cells.slice(headers.length).some((c) => c.trim())) {
      errors.push("This row has more cells than there are columns.");
    }
    for (const [column, value] of Object.entries(raw)) {
      if (FORMULA_START.test(value)) errors.push(`${column}: cells cannot start with =, +, @ or a tab.`);
      if (value.length > 20_000) errors.push(`${column}: the text is too long.`);
    }

    const input: RawInput = {};
    for (const [column, field] of Object.entries(columns)) input[field] = raw[column] ?? "";

    input.description_html = raw.description ? plainToRichText(raw.description) : "";
    input.purpose = PURPOSE_ALIASES[(raw.purpose ?? "").toLowerCase()] ?? raw.purpose ?? "";
    input.features = (raw.features ?? "").replace(/\|/g, ";");
    if (raw.payment_period) input.price_period = PERIOD_ALIASES[raw.payment_period.toLowerCase()] ?? raw.payment_period;
    if (raw.land_size_unit) input.land_size_unit = UNIT_ALIASES[raw.land_size_unit.toLowerCase()] ?? raw.land_size_unit;
    if (raw.land_use) input.land_use = raw.land_use.toLowerCase();

    if (raw.state) {
      const state = matchNigerianState(raw.state);
      if (state) input.state = state;
      else errors.push(`state: “${raw.state}” is not a Nigerian state.`);
    }

    let estateId: string | null = null;
    if (raw.estate) {
      estateId = lookups.estates.get(raw.estate.toLowerCase()) ?? null;
      if (!estateId)
        errors.push(`estate: no active estate is called “${raw.estate}”. Create it first or fix the name.`);
      input.estate_id = estateId ?? "";
    }
    if (kind === "building" && raw.building_type) {
      const typeId = lookups.buildingTypes.get(raw.building_type.toLowerCase()) ?? null;
      if (!typeId) errors.push(`building_type: “${raw.building_type}” is not an available building type.`);
      input.building_type_id = typeId ?? "";
    }

    const parsed = parsePropertyInput(kind, input);
    if (!parsed.ok) {
      const reverse = Object.fromEntries(Object.entries(columns).map(([column, field]) => [field, column]));
      for (const [field, message] of Object.entries(parsed.fieldErrors)) {
        const column = reverse[field] ?? field;
        if (!errors.some((e) => e.startsWith(`${column}:`))) errors.push(`${column}: ${message}`);
      }
    }

    const key = `${(raw.title ?? "").toLowerCase().replace(/\s+/g, " ")}|${(raw.location ?? "").toLowerCase()}`;
    const sameFileAs = raw.title ? (seen.get(key) ?? null) : null;
    if (raw.title && sameFileAs === null) seen.set(key, rowNumber);

    return {
      rowNumber,
      raw,
      input: parsed.ok && errors.length === 0 ? parsed.data : null,
      errors,
      estateId,
      sameFileAs,
    };
  });

  return { headerErrors, rows };
}
