import "server-only";
import { richTextToPlain, sanitizeRichText } from "@/lib/rich-text";
import type { Database } from "@/types/database";
import type { PropertyInput } from "./schemas";

export type PropertyRow = Database["public"]["Tables"]["properties"]["Insert"];

/** Validated input -> database columns. Sanitises the formatted description. */
export function toPropertyRow(input: PropertyInput): PropertyRow {
  const html = sanitizeRichText(input.description_html);
  const plain = html ? richTextToPlain(html).slice(0, 20_000) : "";
  const { description_html: _html, ...rest } = input;
  void _html;
  return { ...rest, description_html: html || null, description: plain || null } as PropertyRow;
}
