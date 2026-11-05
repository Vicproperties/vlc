import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import sharp from "sharp";
import { cleanup, serviceClient } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Stage 9: write and publish an article with formatting, an inline image (alt + caption) and a
 * table; read it on the public blog; Word import fills the editor without saving anything.
 */
test.describe.configure({ mode: "serial", timeout: 300_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
const title = `Buying land safely ${token}`;
let admin: TestAdmin;
let slug = "";

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  admin = await createTestAdmin("blog-super", { role: "super_admin" });
});

test.afterAll(async () => {
  const { data: posts } = await service
    .from("blog_posts")
    .select("id, featured_image_path, content_html")
    .like("title", `%${token}%`);
  const files: string[] = [];
  for (const p of posts ?? []) {
    if (p.featured_image_path) files.push(p.featured_image_path);
    for (const m of (p.content_html ?? "").matchAll(/blog-media\/([^"]+)"/g)) files.push(decodeURIComponent(m[1]));
  }
  if (files.length) await service.storage.from("blog-media").remove(files);
  await service.from("blog_posts").delete().like("title", `%${token}%`);
  await service.from("blog_categories").delete().like("name", `%${token}%`);
  await service.from("blog_authors").delete().like("name", `%${token}%`);
  await cleanup([]);
});

async function docx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">Imported from Word ${token}. </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Bold words</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

test("write, illustrate and publish an article; read it on the public blog", async ({ page }) => {
  await signInAsAdmin(page, admin);

  await page.goto("/admin/blog/categories", { waitUntil: "networkidle" });
  const categoryForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add category" }) });
  await categoryForm.getByRole("textbox", { name: "Name", exact: true }).fill(`Guides ${token}`);
  await categoryForm.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText(`Guides ${token}`)).toBeVisible();
  const authorForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add author" }) });
  await authorForm.getByRole("textbox", { name: "Name", exact: true }).fill(`Ada Writer ${token}`);
  await authorForm.getByRole("button", { name: "Add author" }).click();
  await expect(page.getByText(`Ada Writer ${token}`)).toBeVisible();

  await page.goto("/admin/blog/new", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page.getByRole("textbox", { name: /^Summary/ }).fill("What to check before you pay for a plot.");
  await page.getByLabel(/^Category/).selectOption({ label: `Guides ${token}` });
  await page.getByLabel(/^Author/).selectOption({ label: `Ada Writer ${token}` });

  const editor = page.getByRole("textbox", { name: "Content" });
  await editor.click();
  await page.keyboard.type("Always verify the title documents before paying. ");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("Never pay cash on site.");
  await page.keyboard.press("Control+b");
  await page.keyboard.press("Enter");

  const photo = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#7f9e5c" } })
    .jpeg()
    .toBuffer();
  await page.locator("#article-image-input").setInputFiles({ name: "plot.jpg", mimeType: "image/jpeg", buffer: photo });
  const imageDialog = page.getByRole("dialog", { name: "Image description and caption" });
  await expect(imageDialog).toBeVisible({ timeout: 60_000 });
  await imageDialog.getByLabel(/alt text/).fill("Fenced plot with a gate");
  await imageDialog.getByLabel(/Caption/).fill("A fenced plot in Mowe");
  await imageDialog.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Insert table" }).click();
  await page.keyboard.type("Document");

  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?created=1/, { timeout: 60_000 });

  const { data } = await service.from("blog_posts").select("slug, status, content_html").eq("title", title).single();
  expect(data?.status).toBe("published");
  expect(data?.content_html).toContain("<strong>Never pay cash on site.</strong>");
  slug = data!.slug;

  await page.goto(`/blog/${slug}`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("By Ada Writer", { exact: false }).first()).toBeVisible();
  await expect(page.locator(".rich-text strong")).toHaveText("Never pay cash on site.");
  await expect(page.getByRole("img", { name: "Fenced plot with a gate" })).toBeVisible();
  await expect(page.locator("figcaption")).toHaveText("A fenced plot in Mowe");
  await expect(page.locator(".rich-text table")).toBeVisible();
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.some((t) => t.includes('"Article"'))).toBe(true);
});

test("the blog lists, filters and searches articles; the homepage shows the latest news", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "load" });
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.getByRole("link", { name: `Guides ${token}` }).click();
  await expect(page).toHaveURL(/category=/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.goto(`/blog?q=${encodeURIComponent("cash")}`, { waitUntil: "load" });
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Latest property news" })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("Word import fills the editor for review and saves nothing", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/blog/new", { waitUntil: "networkidle" });
  const { count: before } = await service.from("blog_posts").select("id", { count: "exact", head: true });
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
    name: "article.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await docx(),
  });
  await expect(message(page, /Nothing has been saved yet/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("textbox", { name: "Content" }).getByText(`Imported from Word ${token}.`)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Content" }).locator("strong")).toHaveText("Bold words");
  const { count: after } = await service.from("blog_posts").select("id", { count: "exact", head: true });
  expect(after).toBe(before);
});

test("the FAQ lives on the About page and the old address redirects there", async ({ request }) => {
  const res = await request.get("/faq", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toBe("/about#faq");
});
