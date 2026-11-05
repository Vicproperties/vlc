import { z } from "zod";

/**
 * Editable page sections (`page_sections`). One definition drives the dashboard editor,
 * server validation and the public pages, so they cannot drift apart. No defaults contain
 * company claims: until the owner writes them, pages show neutral wording or omit a section.
 */
export type PageKey = "home" | "about" | "contact";
export type FieldType = "text" | "textarea" | "rich";

export interface SectionField {
  key: string;
  label: string;
  type: FieldType;
  max: number;
  hint?: string;
}

export interface SectionDef {
  page: PageKey;
  key: string;
  title: string;
  description: string;
  fields: SectionField[];
}

const heading = (hint?: string): SectionField => ({ key: "heading", label: "Heading", type: "text", max: 120, hint });
const intro = (hint?: string): SectionField => ({
  key: "text",
  label: "Introduction",
  type: "textarea",
  max: 400,
  hint,
});

export const SECTIONS: SectionDef[] = [
  {
    page: "home",
    key: "hero",
    title: "Hero",
    description: "The large headline and text at the top of the homepage, above the search.",
    fields: [heading("Leave empty to use the neutral default headline."), intro()],
  },
  {
    page: "home",
    key: "featured",
    title: "Featured properties",
    description: "Heading above the featured listings.",
    fields: [heading("Default: “Featured properties”."), intro()],
  },
  {
    page: "home",
    key: "why_choose_us",
    title: "Why choose us",
    description: "Heading for the reasons listed below. The section only appears when it has reasons.",
    fields: [heading("Default: “Why choose us”."), intro()],
  },
  {
    page: "about",
    key: "intro",
    title: "About us",
    description: "The main text of the About page.",
    fields: [heading("Default: “About us”."), { key: "body", label: "Text", type: "rich", max: 20_000 }],
  },
  {
    page: "about",
    key: "mission",
    title: "Mission",
    description: "Shown only when filled in.",
    fields: [{ key: "text", label: "Mission statement", type: "textarea", max: 1000 }],
  },
  {
    page: "about",
    key: "vision",
    title: "Vision",
    description: "Shown only when filled in.",
    fields: [{ key: "text", label: "Vision statement", type: "textarea", max: 1000 }],
  },
  {
    page: "about",
    key: "values",
    title: "Core values",
    description: "Heading for the core values listed below.",
    fields: [heading("Default: “Our values”."), intro()],
  },
  {
    page: "about",
    key: "team",
    title: "Team",
    description: "Heading for the team members (managed under Team).",
    fields: [heading("Default: “Our team”."), intro()],
  },
  {
    page: "contact",
    key: "intro",
    title: "Contact page introduction",
    description: "Text beside the contact form. Contact details come from Website Settings.",
    fields: [heading("Default: “Contact us”."), intro()],
  },
];

export function sectionsFor(page: PageKey): SectionDef[] {
  return SECTIONS.filter((section) => section.page === page);
}

export function findSection(page: string, key: string): SectionDef | undefined {
  return SECTIONS.find((section) => section.page === page && section.key === key);
}

/** Validates submitted fields (rich text is sanitised separately on the server). */
export function sectionSchema(def: SectionDef) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of def.fields) {
    shape[field.key] = z
      .string()
      .trim()
      .max(
        field.type === "rich" ? field.max * 3 : field.max,
        `${field.label} must be ${field.max.toLocaleString("en-NG")} characters or fewer.`,
      );
  }
  return z.object(shape);
}

/** Reads stored content as plain strings; unknown or malformed values are ignored. */
export function readContent(def: SectionDef, value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  for (const field of def.fields) {
    const raw = source[field.key];
    if (typeof raw === "string" && raw.trim())
      out[field.key] = raw.slice(0, field.type === "rich" ? field.max * 3 : field.max);
  }
  return out;
}
