import { z } from "zod";

/**
 * Typed content for the homepage sections stored in `page_sections` (page_key "home").
 * The dashboard editors (Stage 8) write these shapes; the public site reads them with
 * safeParse and falls back to neutral defaults, so a malformed row never breaks the page.
 * Defaults contain no company claims (no invented facts, figures or testimonials).
 */
const text = (max: number) => z.string().trim().min(1).max(max);

export const homeSectionHeadingSchema = z.object({
  heading: text(120).optional(),
  text: text(400).optional(),
});

export type HomeSectionHeading = z.infer<typeof homeSectionHeadingSchema>;

export function readSection<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const parsed = schema.safeParse(value ?? {});
  return parsed.success ? parsed.data : null;
}
