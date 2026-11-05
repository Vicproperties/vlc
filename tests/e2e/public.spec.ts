import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { cleanup, serviceClient, uniqueText } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Public website (Stage 6) against real data. Listings are prepared as drafts in the database,
 * then published through the dashboard's Publish button, which also proves that dashboard
 * changes reach the cached public pages immediately.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const propertyIds: string[] = [];
const storagePaths: string[] = [];
let admin: TestAdmin;
let land: { id: string; slug: string; title: string; token: string };
let building: { id: string; slug: string; title: string };

async function draftWithPhoto(values: Record<string, unknown>) {
  const { data, error } = await service
    .from("properties")
    .insert({
      purpose: "sale",
      state: "Ogun",
      city: "Mowe",
      location_text: "Along Lagos-Ibadan Expressway",
      description: "Well drained land.",
      description_html: "<p><strong>Well drained</strong> land.</p>",
      ...values,
    } as never)
    .select("id, slug, title")
    .single();
  if (error) throw new Error(error.message);
  propertyIds.push(data.id);

  const path = `${data.id}/${randomUUID()}.webp`;
  const photo = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#8a7a60" } })
    .webp()
    .toBuffer();
  const upload = await service.storage.from("property-media").upload(path, photo, { contentType: "image/webp" });
  if (upload.error) throw new Error(upload.error.message);
  storagePaths.push(path);
  await service.from("property_images").insert({
    property_id: data.id,
    storage_path: path,
    width: 1200,
    height: 900,
    is_cover: true,
    alt_text: "Front view of the plot",
  });
  return data;
}

async function publishInDashboard(page: Page, id: string) {
  await page.goto(`/admin/properties/${id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(message(page, "Status changed to published.")).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  // Seeding + two dashboard publishes take longer than the default hook limit on slow links.
  test.setTimeout(240_000);
  await resetAdminRateLimits();
  admin = await createTestAdmin("public-super", { role: "super_admin" });

  const token = randomUUID().slice(0, 8);
  const landRow = await draftWithPhoto({
    kind: "land",
    title: uniqueText(`Riverside Plot ${token}`),
    land_use: "residential",
    land_size: 2,
    land_size_unit: "plot",
    regular_price: 10_000_000,
    sales_price: 8_000_000,
    promotion_active: true,
    features: ["Fenced", "Good road"],
    youtube_video_id: "dQw4w9WgXcQ",
    google_maps_url: "https://maps.app.goo.gl/AbCdEf123",
    is_featured: true,
  });
  land = { ...landRow, token };
  building = await draftWithPhoto({
    kind: "building",
    title: uniqueText("Garden Duplex"),
    purpose: "rent",
    price_period: "per_year",
    state: "Lagos",
    city: "Lekki",
    bedrooms: 4,
    bathrooms: 4,
    regular_price: 6_000_000,
  });

  const page = await browser.newPage();
  await signInAsAdmin(page, admin);
  await publishInDashboard(page, land.id);
  await publishInDashboard(page, building.id);
  await page.close();
});

test.afterAll(async () => {
  if (storagePaths.length) await service.storage.from("property-media").remove(storagePaths);
  await cleanup(propertyIds);
});

test("homepage shows the featured listing and searches properties", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured properties" })).toBeVisible();
  await expect(page.getByRole("link", { name: land.title })).toBeVisible();

  await page.getByLabel("Location or keyword").fill(land.token);
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(new RegExp(`/properties\\?q=${land.token}`));
  await expect(page.getByRole("link", { name: land.title })).toBeVisible();
  await expect(page.getByText("1 property")).toBeVisible();
});

test("filters live in the URL, can be removed, and unmatched filters show an empty state", async ({ page }) => {
  await page.goto("/properties?state=Lagos&purpose=rent", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: building.title })).toBeVisible();
  await expect(page.getByRole("link", { name: land.title })).toHaveCount(0);

  const active = page.getByLabel("Active filters");
  await expect(active.getByRole("link", { name: /Lagos/ })).toBeVisible();
  await active.getByRole("link", { name: /For rent/ }).click();
  await page.waitForURL(/\/properties\?state=Lagos$/);

  await page.goto(`/properties?q=${land.token}&kind=building`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "No properties match these filters" })).toBeVisible();

  // Untrusted parameters are ignored, never echoed or crashing the page.
  const response = await page.goto("/properties?state=<script>&min_price=abc&page=-4&sort=evil");
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel("Active filters")).toHaveCount(0);
});

test("property page shows details, price, gallery, video and structured data", async ({ page }) => {
  // Property pages hold the Turnstile widget, which keeps the network busy: wait for load.
  await page.goto(`/properties/${land.slug}`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1, name: land.title })).toBeVisible();
  await expect(page.getByText("20% off").first()).toBeVisible();
  await expect(page.getByText("₦8,000,000").first()).toBeVisible();
  await expect(page.getByText("2 plots").first()).toBeVisible();
  await expect(page.locator(".rich-text strong")).toHaveText("Well drained");
  await expect(page.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("button", { name: /Play video/ })).toBeVisible();

  await page.getByRole("button", { name: "Open photo 1 of 1" }).click();
  await expect(page.getByRole("dialog", { name: "Photo 1 of 1" })).toBeVisible();
  await page.keyboard.press("Escape");

  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = jsonLd.map((text) => (JSON.parse(text) as { "@type": string })["@type"]);
  expect(types).toEqual(expect.arrayContaining(["Organization", "RealEstateListing", "BreadcrumbList"]));
  await expect(page).toHaveTitle(new RegExp(land.title.slice(0, 20)));
});

test("drafts are not public; unavailable listings stay visible and marked", async ({ page }) => {
  const { data: draft } = await service
    .from("properties")
    .insert({ kind: "land", title: uniqueText("Hidden Draft") } as never)
    .select("id, slug")
    .single();
  propertyIds.push(draft!.id);
  // Under Partial Prerendering the status of a never-built URL is committed before the lookup,
  // so a missing listing renders the not-found page with a noindex tag (ADR-003).
  await page.goto(`/properties/${draft!.slug}`, { waitUntil: "networkidle" });
  await expect(page.getByText("Page not found")).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByText("Hidden Draft")).toHaveCount(0);

  await signInAsAdmin(page, admin);
  await page.goto(`/admin/properties/${building.id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mark as unavailable" }).click();
  await expect(message(page, "Status changed to unavailable.")).toBeVisible();

  await page.goto(`/properties/${building.slug}`, { waitUntil: "load" });
  await expect(page.getByText("This property is currently unavailable.")).toBeVisible();
  await page.goto("/properties?availability=available&state=Lagos", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: building.title })).toHaveCount(0);
});

test("sitemap and robots", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/properties/${land.slug}`);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/admin/);
  expect(robots).toMatch(/Sitemap: /);
});

test("public pages have no serious accessibility problems", async ({ page }) => {
  for (const path of ["/", "/properties", `/properties/${land.slug}`]) {
    await page.goto(path, { waitUntil: "load" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});
