import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Server-side sanitising for "simple formatted text" (owner decision 2026-11-04):
 * paragraphs, line breaks, bold, italic, sub-headings and bullet/numbered lists.
 * Everything else (scripts, styles, attributes, links, images, iframes) is removed. The
 * editor offers only these formats, but the server never trusts what the browser sends.
 */
const ALLOWED_TAGS = ["p", "br", "strong", "em", "h3", "ul", "ol", "li"];

/**
 * `document: true` (legal pages) additionally keeps main headings (h2), so long documents
 * can be structured. Everything else stays the same.
 */
export function sanitizeRichText(html: string, options: { document?: boolean } = {}): string {
  const top = options.document ? "h2" : "h3";
  const clean = sanitizeHtml(html, {
    allowedTags: options.document ? [...ALLOWED_TAGS, "h2"] : ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    // Map editor output variants onto the allowed set.
    transformTags: { b: "strong", i: "em", h1: top, h2: top, h4: "h3", h5: "h3", h6: "h3", div: "p" },
    exclusiveFilter: (frame) => frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length,
  }).trim();
  return clean === "<p></p>" ? "" : clean;
}

/** Plain-text version for search, previews and meta descriptions. */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h3|li)>|<br\s*\/?>/gi, "$&\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export { plainToRichText } from "./plain-text";
