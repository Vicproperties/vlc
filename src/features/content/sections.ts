import { z } from "zod";

/**
 * Editable page sections (`page_sections`). One definition drives the dashboard editor,
 * server validation and the public pages, so they cannot drift apart. No defaults contain
 * company claims: until the owner writes them, pages show neutral wording or omit a section.
 */
export type PageKey = "home" | "about" | "contact";
/** "image" stores a site-media path; the file itself is uploaded and processed on the server. */
export type FieldType = "text" | "textarea" | "rich" | "image";

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
    fields: [
      heading("Leave empty to use the neutral default headline."),
      intro(),
      {
        key: "image_path",
        label: "Background image",
        type: "image",
        max: 500,
        hint: "Optional. A wide landscape photo works best (at least 1600 px wide). A dark tint is added so the text stays readable.",
      },
    ],
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
    fields: [
      heading("Default: “About us”."),
      { key: "body", label: "Text", type: "rich", max: 20_000 },
      {
        key: "image_path",
        label: "Photo",
        type: "image",
        max: 500,
        hint: "Optional. Shown beside the text on the About page and the homepage preview (for example your office or a project). Portrait or square works best.",
      },
    ],
  },
  {
    page: "about",
    key: "ceo",
    title: "CEO",
    description: "Introduces the CEO on the About page. Shown once a name is filled in.",
    fields: [
      heading("Default: “Meet our CEO”."),
      { key: "name", label: "Full name", type: "text", max: 120 },
      {
        key: "designation",
        label: "Designation",
        type: "text",
        max: 120,
        hint: "For example: Chief Executive Officer.",
      },
      { key: "bio", label: "Short biography", type: "textarea", max: 2000 },
      {
        key: "image_path",
        label: "Photograph",
        type: "image",
        max: 500,
        hint: "A professional portrait (taller than wide works best).",
      },
    ],
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
    description:
      "Heading and introduction for the Team page (/team) and the team preview on the About page. Members are managed under Team.",
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
    if (field.type === "image") continue; // handled as a file upload
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
    if (typeof raw !== "string" || !raw.trim()) continue;
    // Image fields must be a safe path inside the sections folder of site-media.
    if (field.type === "image" && !/^sections\/[a-z0-9-]+\.webp$/.test(raw)) continue;
    out[field.key] = raw.slice(0, field.type === "rich" ? field.max * 3 : field.max);
  }
  return out;
}
