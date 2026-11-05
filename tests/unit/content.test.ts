import { describe, expect, it } from "vitest";
import { PRIVACY_POLICY_DRAFT } from "@/features/content/legal-drafts";
import { findSection, readContent, SECTIONS, sectionSchema, sectionsFor } from "@/features/content/sections";
import { richTextToPlain, sanitizeRichText } from "@/lib/rich-text";

describe("page sections", () => {
  it("are unique per page and have fields", () => {
    const keys = SECTIONS.map((s) => `${s.page}/${s.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const section of SECTIONS) expect(section.fields.length).toBeGreaterThan(0);
    expect(sectionsFor("about").map((s) => s.key)).toEqual(["intro", "mission", "vision", "values", "team"]);
  });

  it("validate field lengths", () => {
    const hero = findSection("home", "hero")!;
    expect(sectionSchema(hero).safeParse({ heading: "Welcome", text: "Hello" }).success).toBe(true);
    expect(sectionSchema(hero).safeParse({ heading: "x".repeat(121), text: "" }).success).toBe(false);
  });

  it("read only known string fields from stored content", () => {
    const hero = findSection("home", "hero")!;
    expect(readContent(hero, { heading: "Hi", text: 42, extra: "ignored" })).toEqual({ heading: "Hi" });
    expect(readContent(hero, null)).toEqual({});
    expect(readContent(hero, "not an object")).toEqual({});
  });

  it("never ship company claims as defaults", () => {
    // Defaults live in page code as neutral wording; definitions carry hints only.
    for (const section of SECTIONS) {
      for (const field of section.fields)
        expect(field.hint ?? "").not.toMatch(/\d+\s*(years|clients|properties sold)/i);
    }
  });
});

describe("document sanitising (legal pages)", () => {
  it("keeps main headings only in document mode", () => {
    const html = "<h2>Who we are</h2><p>Text</p>";
    expect(sanitizeRichText(html, { document: true })).toBe(html);
    expect(sanitizeRichText(html)).toBe("<h3>Who we are</h3><p>Text</p>");
  });

  it("still removes scripts, links and attributes", () => {
    expect(
      sanitizeRichText('<h2 onclick="x()">A</h2><a href="https://e.com">b</a><script>1</script>', { document: true }),
    ).toBe("<h2>A</h2>b");
  });

  it("the starter privacy draft survives sanitising and is clearly marked", () => {
    const clean = sanitizeRichText(PRIVACY_POLICY_DRAFT, { document: true });
    expect(richTextToPlain(clean)).toMatch(/^DRAFT FOR LEGAL REVIEW/);
    expect(clean).toContain("<h2>Your rights</h2>");
    expect(clean).toContain("Nigeria Data Protection Act 2023");
    expect(clean.length).toBeGreaterThan(PRIVACY_POLICY_DRAFT.length * 0.9);
  });
});
