import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { cleanup, serviceClient } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { createTestCustomer, resetCustomerRateLimits } from "./customer-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Blog likes and comments (signed-in customers; moderators delete) and the logo / browser
 * icon uploads in Website Settings.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
const title = `Engagement article ${token}`;
const commentText = `Very helpful guide ${token}`;
let slug = "";
let admin: TestAdmin;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  await resetCustomerRateLimits();
  admin = await createTestAdmin("engagement-super", { role: "super_admin" });
  const { data, error } = await service
    .from("blog_posts")
    .insert({
      title,
      status: "published",
      published_at: new Date().toISOString(),
      content_html: "<p>Body text.</p>",
    } as never)
    .select("slug")
    .single();
  if (error) throw new Error(error.message);
  slug = (data as { slug: string }).slug;
});

test.afterAll(async () => {
  await service.from("blog_posts").delete().like("title", `%${token}%`);
  // Restore the settings this test changed.
  const { data } = await service.from("site_settings").select("logo_path, favicon_path").eq("id", 1).single();
  const paths = [data?.logo_path, data?.favicon_path].filter((p): p is string => Boolean(p?.includes("branding/")));
  if (paths.length) await service.storage.from("site-media").remove(paths);
  await service
    .from("site_settings")
    .update({ logo_path: null, favicon_path: null } as never)
    .eq("id", 1);
  await cleanup([]);
});

test("signed-out visitors are asked to sign in to like or comment", async ({ page }) => {
  await page.goto(`/blog/${slug}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.getByRole("button", { name: /^Like/ }).click();
  await expect(page.getByText("Sign in to your customer account to like and comment.")).toBeVisible();
  await expect(page.getByRole("link", { name: "create a free account" })).toBeVisible();
});

test("a customer likes, comments and deletes their own comment", async ({ page }) => {
  const customer = await createTestCustomer("engage");
  await page.goto(`/account/login?next=${encodeURIComponent(`/blog/${slug}`)}`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /^Email address/ }).fill(customer.email);
  await page.getByLabel(/^Password/).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(new RegExp(`/blog/${slug}`));

  const like = page.getByRole("button", { name: /^Like/ });
  await like.click();
  await expect(page.getByRole("button", { name: /^Liked/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Liked/ })).toContainText("1");

  await page.getByLabel("Add a comment").fill(commentText);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText(commentText)).toBeVisible();
  await expect(page.getByLabel("Add a comment")).toHaveValue("");

  // Second comment, then delete it as its author.
  await page.getByLabel("Add a comment").fill(`Second thought ${token}`);
  await page.getByRole("button", { name: "Post comment" }).click();
  const second = page.getByRole("listitem").filter({ hasText: `Second thought ${token}` });
  await expect(second).toBeVisible();
  await second.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(`Second thought ${token}`)).toHaveCount(0);

  // Unlike.
  await page.getByRole("button", { name: /^Liked/ }).click();
  await expect(page.getByRole("button", { name: /^Like/ })).toHaveAttribute("aria-pressed", "false");
});

test("an admin deletes a comment from the dashboard", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/blog/comments", { waitUntil: "networkidle" });
  const item = page.getByRole("listitem").filter({ hasText: commentText });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete this comment?" })
    .getByRole("button", { name: "Delete permanently" })
    .click();
  await expect(page.getByText(commentText)).toHaveCount(0);

  await page.goto(`/blog/${slug}`, { waitUntil: "networkidle" });
  await expect(page.getByText(commentText)).toHaveCount(0);
});

test("logo and browser icon upload in Website Settings", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  const png = await sharp({ create: { width: 600, height: 200, channels: 4, background: "#6b4ba6" } })
    .png()
    .toBuffer();
  await page.locator("#branding-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page
    .locator("form")
    .filter({ has: page.locator("#branding-logo") })
    .getByRole("button", { name: "Upload" })
    .click();
  await expect(message(page, "Logo updated.")).toBeVisible();

  const icon = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#6b4ba6" } })
    .png()
    .toBuffer();
  await page.locator("#branding-favicon").setInputFiles({ name: "icon.png", mimeType: "image/png", buffer: icon });
  await page
    .locator("form")
    .filter({ has: page.locator("#branding-favicon") })
    .getByRole("button", { name: "Upload" })
    .click();
  await expect(message(page, "Browser icon updated.")).toBeVisible();

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("header").getByRole("img", { name: "Vic Land and Property" })).toBeVisible();
  await expect(page.locator('link[rel="icon"][href*="branding/favicon-"]')).toBeAttached();

  // A non-image file is refused.
  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  await page
    .locator("#branding-logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await page
    .locator("form")
    .filter({ has: page.locator("#branding-logo") })
    .getByRole("button", { name: "Upload" })
    .click();
  await expect(message(page, "This file could not be read as an image.")).toBeVisible();
});
