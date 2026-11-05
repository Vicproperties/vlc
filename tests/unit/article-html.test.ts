import { beforeAll, describe, expect, it } from "vitest";

const BASE = "https://example.supabase.co";
let sanitize: (html: string) => string;
let paths: (html: string) => string[];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
  const mod = await import("@/lib/article-html");
  sanitize = mod.sanitizeArticleHtml;
  paths = mod.articleImagePaths;
});

const img = `${BASE}/storage/v1/object/public/blog-media/articles/a.webp`;

describe("article sanitising", () => {
  it("keeps the supported formatting", () => {
    const html =
      '<h2 style="text-align:center">Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p>' +
      "<ul><li>one</li></ul><ol><li>two</li></ol>" +
      "<table><tbody><tr><th>A</th><td>B</td></tr></tbody></table>";
    expect(sanitize(html)).toBe(html);
  });

  it("keeps figures with alt text and captions from our own storage only", () => {
    const ours = `<figure><img src="${img}" alt="Plot frontage" /><figcaption>Front view</figcaption></figure>`;
    expect(sanitize(ours)).toContain(`<img src="${img}" alt="Plot frontage" loading="lazy" />`);
    expect(sanitize(ours)).toContain("<figcaption>Front view</figcaption>");
    expect(sanitize('<img src="https://evil.example/x.png" />')).toBe("");
    expect(sanitize('<img src="data:image/png;base64,AAAA" />')).toBe("");
  });

  it("allows only privacy-enhanced YouTube embeds", () => {
    const ok = '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe></div>';
    expect(sanitize(ok)).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(sanitize('<iframe src="https://evil.example/embed/x"></iframe>')).toBe("");
    expect(sanitize('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')).toBe("");
  });

  it("makes links safe and drops dangerous ones", () => {
    expect(sanitize('<a href="https://site.ng" onclick="x()">x</a>')).toBe(
      '<a href="https://site.ng" rel="noopener noreferrer nofollow" target="_blank">x</a>',
    );
    expect(sanitize('<a href="javascript:alert(1)">x</a>')).toBe("x");
  });

  it("removes scripts, event handlers and any style except alignment", () => {
    expect(sanitize('<p style="color:red; text-align:right" onmouseover="x()">t</p><script>alert(1)</script>')).toBe(
      '<p style="text-align:right">t</p>',
    );
  });

  it("lists the storage paths of embedded images", () => {
    expect(paths(`<p>x</p><img src="${img}" alt="" /><img src="https://other.example/y.webp" />`)).toEqual(["articles/a.webp"]);
  });
});
