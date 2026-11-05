import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { cleanup, serviceClient } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Stage 8: content changes made in the dashboard appear on the public site immediately.
 * The original rows (home hero, privacy policy, site settings) are saved first and restored
 * afterwards; test FAQs and team members are deleted. Real content is never left changed.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
let admin: TestAdmin;
let originalHero: { content: unknown; is_visible: boolean } | null = null;
let originalPrivacy: Record<string, unknown> | null = null;
let originalSettings: Record<string, unknown> | null = null;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  admin = await createTestAdmin("content-super", { role: "super_admin" });
  originalHero = (
    await service
      .from("page_sections")
      .select("content, is_visible")
      .eq("page_key", "home")
      .eq("section_key", "hero")
      .maybeSingle()
  ).data;
  originalPrivacy = (await service.from("legal_pages").select("*").eq("slug", "privacy-policy").maybeSingle()).data;
  originalSettings = (await service.from("site_settings").select("*").eq("id", 1).single()).data;
});

test.afterAll(async () => {
  if (originalHero)
    await service.from("page_sections").upsert({ page_key: "home", section_key: "hero", ...originalHero } as never);
  else await service.from("page_sections").delete().eq("page_key", "home").eq("section_key", "hero");
  if (originalPrivacy) await service.from("legal_pages").upsert(originalPrivacy as never);
  else await service.from("legal_pages").delete().eq("slug", "privacy-policy");
  if (originalSettings)
    await service
      .from("site_settings")
      .update(originalSettings as never)
      .eq("id", 1);
  await service.from("faqs").delete().like("question", `%${token}%`);
  const { data: members } = await service.from("team_members").select("id, photo_path").like("name", `%${token}%`);
  const photos = (members ?? []).flatMap((m) => (m.photo_path ? [m.photo_path] : []));
  if (photos.length) await service.storage.from("site-media").remove(photos);
  await service.from("team_members").delete().like("name", `%${token}%`);
  await cleanup([]);
});

test("homepage headline edited in the dashboard appears on the website", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/content/home", { waitUntil: "networkidle" });
  const hero = page.locator("form").filter({ has: page.getByRole("button", { name: "Save hero" }) });
  await hero.getByLabel("Heading").fill(`Land you can trust ${token}`);
  await hero.getByRole("button", { name: "Save hero" }).click();
  await expect(message(page, "Saved. The website is updated.")).toBeVisible();

  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Land you can trust ${token}`);
});

test("FAQ added in the dashboard appears on the FAQ page", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/content/faq", { waitUntil: "networkidle" });
  const question = `Can I pay in instalments ${token}?`;
  await page.getByRole("textbox", { name: "Question", exact: true }).fill(question);
  await page.getByRole("textbox", { name: "Answer", exact: true }).fill("Some properties offer instalment plans.");
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByText(question)).toBeVisible();

  await page.goto("/faq", { waitUntil: "load" });
  await page.getByText(question).click();
  await expect(page.getByText("Some properties offer instalment plans.")).toBeVisible();
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.some((text) => text.includes("FAQPage") && text.includes(token))).toBe(true);
});

test("team member with photo appears on the About page", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/content/team", { waitUntil: "networkidle" });
  const name = `Amaka Test ${token}`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: /Position/ }).fill("Sales Manager");
  const photo = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#6b4ba6" } })
    .jpeg()
    .toBuffer();
  await page.getByLabel(/^Photo/).setInputFiles({ name: "amaka.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Add team member" }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 60_000 });

  await page.goto("/about", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("img", { name: `Photo of ${name}` })).toBeVisible();
});

test("privacy policy: insert the starter draft, publish, and read it on the website", async ({ page }) => {
  await service.from("legal_pages").delete().eq("slug", "privacy-policy");
  await signInAsAdmin(page, admin);
  await page.goto("/admin/content/privacy-policy", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Insert the starter draft/ }).click();
  await page.getByLabel("Published on the website").check();
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(message(page, "Saved and published.")).toBeVisible();

  await page.goto("/privacy-policy", { waitUntil: "load" });
  await expect(page.getByText("DRAFT FOR LEGAL REVIEW", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your rights" })).toBeVisible();
});

test("website settings: contact details appear in the footer and on the contact page", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  await page.getByLabel(/Short description/).fill(`Trusted land advisers ${token}`);
  await page.getByRole("textbox", { name: /^Email address/ }).fill("hello@example.com");
  await page.getByRole("textbox", { name: /Main phone number/ }).fill("0803 123 4567");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(message(page, "Settings saved.")).toBeVisible();

  await page.goto("/contact", { waitUntil: "load" });
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText(`Trusted land advisers ${token}`)).toBeVisible();
  await expect(footer.getByRole("link", { name: "hello@example.com" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "+234 803 123 4567" })).toBeVisible();
  // WhatsApp (set earlier by the owner) is kept.
  await expect(page.getByRole("main").getByRole("link", { name: /Chat on WhatsApp/ })).toBeVisible();
});
