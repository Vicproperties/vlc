import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitiser for blog articles (owner requirements: headings, bold, italic, underline,
 * strikethrough, lists, alignment, links, tables, images with captions and alt text, YouTube).
 * Applied when saving and again when rendering. Anything else is removed:
 *   - images only from this project's blog-media bucket,
 *   - iframes only from youtube-nocookie.com/embed/<11-char id>,
 *   - links only http(s)/mailto, always rel="noopener noreferrer nofollow",
 *   - the only inline style kept is text-align.
 */
function blogMediaPrefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/blog-media/`;
}

const YOUTUBE_EMBED = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}(\?[A-Za-z0-9_=&-]*)?$/;
const ALIGN = /^(left|right|center|justify)$/;

export function sanitizeArticleHtml(html: string): string {
  const prefix = blogMediaPrefix();
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "img",
      "figcaption",
      "div",
      "iframe",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "width", "height", "loading"],
      iframe: ["src", "width", "height", "title", "allowfullscreen", "loading"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      div: ["data-youtube-video"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: { "*": { "text-align": [ALIGN] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"], iframe: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      b: "strong",
      i: "em",
      strike: "s",
      del: "s",
      h1: "h2",
      h5: "h4",
      h6: "h4",
      // Unsafe or missing targets become plain text (span is not allowed, so only the words remain).
      a: (tagName, attribs) => {
        const href = (attribs.href ?? "").trim();
        if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(href)) return { tagName: "span", attribs: {} };
        return {
          tagName,
          attribs: {
            href,
            rel: "noopener noreferrer nofollow",
            ...(/^https?:/i.test(href) ? { target: "_blank" } : {}),
          },
        };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: { src: attribs.src ?? "", title: attribs.title || "Video", allowfullscreen: "true", loading: "lazy" },
      }),
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") return !frame.attribs.src?.startsWith(prefix);
      if (frame.tag === "iframe") return !YOUTUBE_EMBED.test(frame.attribs.src ?? "");
      if (frame.tag === "div") return frame.attribs["data-youtube-video"] === undefined;
      return false;
    },
  }).trim();
}

/** Every blog-media path referenced by an article (to delete images with the article). */
export function articleImagePaths(html: string): string[] {
  const prefix = blogMediaPrefix();
  const paths = new Set<string>();
  for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (match[1].startsWith(prefix)) paths.add(decodeURIComponent(match[1].slice(prefix.length)));
  }
  return [...paths];
}
