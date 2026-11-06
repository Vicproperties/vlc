import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanup, serviceClient, sql, uniqueText } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Stage 11 parts 2 and 3: cookie choice, statistics only after consent, the analytics,
 * cookie, activity log and media pages, and the overview figures.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
const propertyIds: string[] = [];
let admin: TestAdmin;
let property: { id: string; slug: string; title: string };
const noChoice = { storageState: { cookies: [], origins: [] } };

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  await sql("delete from private.rate_limits where key like 'consent:%' or key like 'analytics:%'");
  admin = await createTestAdmin("analytics-super", { role: "super_admin" });
  const { data, error } = await service
    .from("properties")
    .insert({
      kind: "land",
      purpose: "sale",
      status: "published",
      title: uniqueText(`Analytics Plot ${token}`),
      state: "Lagos",
    } as never)
    .select("id, slug, title")
    .single();
  if (error) throw new Error(error.message);
  property = data;
  propertyIds.push(data.id);
});

test.afterAll(async () => {
  await service.from("analytics_events").delete().eq("property_id", property.id);
  await cleanup(propertyIds);
});

test("essential only: the choice is remembered and no statistics are sent", async ({ browser }) => {
  const context = await browser.newContext(noChoice);
  const page = await context.newPage();
  const beacons: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/analytics")) beacons.push(r.url());
  });
  await page.goto("/", { waitUntil: "networkidle" });
  const bar = page.getByRole("region", { name: "Cookie choice" });
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Essential only" }).click();
  await expect(bar).toBeHidden();

  // Property pages keep the Turnstile widget connected: wait for load, not network idle.
  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  await expect(page.getByRole("region", { name: "Cookie choice" })).toBeHidden();
  expect(beacons).toEqual([]);
  const cookie = (await context.cookies()).find((c) => c.name === "vl_consent");
  expect(decodeURIComponent(cookie!.value)).toMatch(/^1\.0\./);

  // The footer link reopens the choice.
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.getByRole("region", { name: "Cookie choice" })).toBeVisible();
  await context.close();
});

test("accepting statistics records the visit and the property view", async ({ browser }) => {
  const context = await browser.newContext(noChoice);
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("region", { name: "Cookie choice" }).getByRole("button", { name: "Accept statistics" }).click();

  // Property pages keep the Turnstile widget connected: wait for load, not network idle.
  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  const sid = await page.evaluate(() => sessionStorage.getItem("vl_sid"));
  expect(sid).toBeTruthy();

  await expect
    .poll(async () => {
      const { data } = await service
        .from("analytics_events")
        .select("type")
        .eq("session_id", sid!)
        .eq("property_id", property.id);
      return (data ?? []).map((e) => e.type).sort();
    })
    .toEqual(["page_view", "property_view"]);
  const { data: session } = await service
    .from("analytics_sessions")
    .select("device_type, source, landing_path")
    .eq("id", sid!)
    .single();
  expect(session).toMatchObject({ device_type: "desktop", source: "direct", landing_path: "/" });
  await context.close();
});

test("dashboard: analytics, cookies, activity log, media library and overview", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await expect(page.getByText("Visitors in the last 7 days")).toBeVisible();

  await page.goto("/admin/analytics?days=7", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Visitor analytics" })).toBeVisible();
  await expect(page.getByRole("link", { name: property.title })).toBeVisible();

  await page.goto("/admin/cookies", { waitUntil: "networkidle" });
  await expect(page.getByText("Accepted statistics")).toBeVisible();
  await page.getByRole("button", { name: "Save cookie settings" }).click();
  await expect(message(page, "Cookie settings saved.")).toBeVisible();

  await page.goto("/admin/activity?area=cookies", { waitUntil: "networkidle" });
  const row = page.getByRole("row").filter({ hasText: "Changed cookie settings" }).first();
  await expect(row).toContainText(admin.name);

  await page.goto("/admin/media", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
  await page.getByRole("link", { name: "Website images" }).click();
  await expect(page).toHaveURL(/library=site-media/);

  // Every menu item now leads to a real page.
  for (const name of ["Marketing", "Media Library", "Visitor Analytics", "Cookie Management", "Activity Logs"]) {
    await expect(page.getByRole("navigation").first().getByRole("link", { name, exact: true })).toBeVisible();
  }
});
