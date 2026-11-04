import { expect, test } from "@playwright/test";

test("home page renders with navigation and footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("development-only pages are not available in production", async ({ request }) => {
  expect((await request.get("/design")).status()).toBe(404);
  const admin = await request.get("/admin");
  expect(admin.status()).toBe(404);
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
});

test("unknown routes show the not-found page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("mobile menu opens and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  // Wait for hydration: the menu button is server-rendered but becomes interactive once React loads.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Properties" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
