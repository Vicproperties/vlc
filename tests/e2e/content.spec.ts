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
let originalCeo: { content: unknown; is_visible: boolean } | null = null;

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
  originalCeo = (
    await service
      .from("page_sections")
      .select("content, is_visible")
      .eq("page_key", "about")
      .eq("section_key", "ceo")
      .maybeSingle()
  ).data;
  originalPrivacy = (await service.from("legal_pages").select("*").eq("slug", "privacy-policy").maybeSingle()).data;
  originalSettings = (await service.from("site_settings").select("*").eq("id", 1).single()).data;
});

test.afterAll(async () => {
  // Remove hero images uploaded by this run (keep the original one, if there was one).
  const keep = (originalHero?.content as { image_path?: string } | undefined)?.image_path;
  const { data: current } = await service
    .from("page_sections")
    .select("content")
    .eq("page_key", "home")
    .eq("section_key", "hero")
    .maybeSingle();
  const uploaded = (current?.content as { image_path?: string } | undefined)?.image_path;
  if (uploaded && uploaded !== keep) await service.storage.from("site-media").remove([uploaded]);
  if (originalHero)
    await service.from("page_sections").upsert({ page_key: "home", section_key: "hero", ...originalHero } as never);
  else await service.from("page_sections").delete().eq("page_key", "home").eq("section_key", "hero");
  // CEO section: remove photos uploaded by this run and restore the original row.
  const keepCeo = (originalCeo?.content as { image_path?: string } | undefined)?.image_path;
  const { data: ceoNow } = await service
    .from("page_sections")
    .select("content")
    .eq("page_key", "about")
    .eq("section_key", "ceo")
    .maybeSingle();
  const ceoPhoto = (ceoNow?.content as { image_path?: string } | undefined)?.image_path;
  if (ceoPhoto && ceoPhoto !== keepCeo) await service.storage.from("site-media").remove([ceoPhoto]);
  if (originalCeo)
    await service.from("page_sections").upsert({ page_key: "about", section_key: "ceo", ...originalCeo } as never);
  else await service.from("page_sections").delete().eq("page_key", "about").eq("section_key", "ceo");
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

test("hero background image: upload, show behind readable text, then remove", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/content/home", { waitUntil: "networkidle" });
  const hero = page.locator("form").filter({ has: page.getByRole("button", { name: "Save hero" }) });
  const photo = await sharp({ create: { width: 3000, height: 1600, channels: 3, background: "#ffffff" } })
    .jpeg()
    .toBuffer();
  await hero.getByLabel(/Background image/).setInputFiles({ name: "hero.jpg", mimeType: "image/jpeg", buffer: photo });
  await hero.getByRole("button", { name: "Save hero" }).click();
  await expect(message(page, "Saved. The website is updated.")).toBeVisible({ timeout: 60_000 });

  const { data } = await service
    .from("page_sections")
    .select("content")
    .eq("page_key", "home")
    .eq("section_key", "hero")
    .single();
  const path = (data?.content as { image_path?: string }).image_path;
  expect(path).toMatch(/^sections\/home-hero-[0-9a-f-]+\.webp$/);
  const stored = await service.storage.from("site-media").download(path!);
  const meta = await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata();
  expect(meta).toMatchObject({ format: "webp", width: 2400 });

  await page.goto("/", { waitUntil: "load" });
  const heroSection = page.locator("section").first();
  await expect(heroSection.locator("img")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("color", "rgb(255, 255, 255)");

  await page.goto("/admin/content/home", { waitUntil: "networkidle" });
  await hero.getByLabel("Remove the current image").check();
  await hero.getByRole("button", { name: "Save hero" }).click();
  await expect(message(page, "Saved. The website is updated.")).toBeVisible();
  const removed = await service.storage.from("site-media").list("sections");
  expect((removed.data ?? []).some((file) => path!.endsWith(file.name))).toBe(false);
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

  // The full Team page lists the member too, reached from the main menu.
  await page.goto("/", { waitUntil: "load" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Team" }).click();
  await page.waitForURL(/\/team$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("img", { name: `Photo of ${name}` })).toBeVisible();
});

test("CEO section is managed in the dashboard and shown on the About page", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/content/about", { waitUntil: "networkidle" });
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save ceo" }) });
  const ceoName = `Victoria Test ${token}`;
  await form.getByRole("textbox", { name: /^Full name/ }).fill(ceoName);
  await form.getByRole("textbox", { name: /^Designation/ }).fill("Chief Executive Officer");
  await form
    .getByRole("textbox", { name: /^Short biography/ })
    .fill("Leads the company with a focus on clear documents.");
  const photo = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#32174d" } })
    .jpeg()
    .toBuffer();
  await form.getByLabel(/^Photograph/).setInputFiles({ name: "ceo.jpg", mimeType: "image/jpeg", buffer: photo });
  await form.getByRole("button", { name: "Save ceo" }).click();
  await expect(message(page, "Saved. The website is updated.")).toBeVisible({ timeout: 60_000 });

  await page.goto("/about", { waitUntil: "load" });
  const ceo = page.getByRole("region", { name: "Meet our CEO" });
  await expect(ceo.getByText(ceoName).first()).toBeVisible();
  await expect(ceo.getByText("Leads the company with a focus on clear documents.")).toBeVisible();
  await expect(ceo.getByRole("img", { name: `Photo of ${ceoName}` })).toBeVisible();
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
  await page.getByRole("textbox", { name: /WhatsApp number/ }).fill("0803 765 4321");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(message(page, "Settings saved.")).toBeVisible();

  await page.goto("/contact", { waitUntil: "load" });
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText(`Trusted land advisers ${token}`)).toBeVisible();
  await expect(footer.getByRole("link", { name: "hello@example.com" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "+234 803 123 4567" })).toBeVisible();
  // The WhatsApp number shows as a chat link.
  await expect(page.getByRole("main").getByRole("link", { name: /Chat on WhatsApp/ })).toBeVisible();
});
