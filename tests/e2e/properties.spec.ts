import { expect, test, type Page } from "@playwright/test";
import sharp, { type Exif } from "sharp";
import { anonClient, cleanup, serviceClient, uniqueText } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Stage 5 journeys through the real dashboard and the development database:
 * create -> photos -> publish, duplicate review, permission-limited editors, estates, CSV import.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const propertyIds: string[] = [];
let superAdmin: TestAdmin;

test.beforeAll(async () => {
  await resetAdminRateLimits();
  superAdmin = await createTestAdmin("props-super", { role: "super_admin" });
});

test.afterAll(async () => {
  const service = serviceClient();
  const { data } = await service.from("property_images").select("storage_path").in("property_id", propertyIds);
  if (data?.length) await service.storage.from("property-media").remove(data.map((row) => row.storage_path));
  await service.from("estates").delete().like("name", "E2E Estate %");
  await cleanup(propertyIds);
});

function idFromUrl(page: Page): string {
  const match = page.url().match(/\/admin\/properties\/([0-9a-f-]{36})/);
  if (!match) throw new Error(`No property id in ${page.url()}`);
  propertyIds.push(match[1]);
  return match[1];
}

async function createLand(page: Page, title: string, extra: { location?: string } = {}) {
  await page.goto("/admin/properties/new", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /^Land/ }).click();
  await page.waitForURL(/\/new\/land$/);
  await page.waitForLoadState("networkidle");
  // By accessible name ("Title"): the visible label also shows a required asterisk.
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Description", exact: true }).click();
  await page.keyboard.type("Dry, fenced land close to the expressway.");
  await page.getByLabel("State", { exact: true }).selectOption("Lagos");
  await page.getByLabel("City or area").fill("Lekki");
  await page.getByLabel("Location description").fill(extra.location ?? "Off Admiralty Way, Lekki Phase 1");
  await page.getByLabel("Land size", { exact: true }).fill("600");
  await page.getByLabel("Unit", { exact: true }).selectOption("sqm");
  await page.getByLabel("Regular price (₦)").fill("25,000,000");
  await page.getByLabel("Sales price (₦)").fill("20,000,000");
  await page.getByLabel("Promotion active").check();
  await expect(page.getByText(/\(20% off\)/)).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/admin\/properties\/[0-9a-f-]{36}\?created=1/);
  return idFromUrl(page);
}

/** A large phone-style photo carrying GPS metadata. */
async function photoWithGps(): Promise<Buffer> {
  return (
    sharp({ create: { width: 3200, height: 2400, channels: 3, background: "#7a6a52" } })
      .jpeg({ quality: 90 })
      // GPS tags are supported at runtime but missing from sharp's type definitions.
      .withExifMerge({
        IFD0: { Copyright: "Owner" },
        GPS: { GPSLatitudeRef: "N", GPSLatitude: "6/1 26/1 0/1" },
      } as unknown as Exif)
      .toBuffer()
  );
}

test("create land, add a photo (resized, metadata removed), publish with a live discount", async ({ page }) => {
  await signInAsAdmin(page, superAdmin);
  const title = uniqueText("E2E Plot");
  const id = await createLand(page, title);
  await expect(message(page, "Draft saved.")).toBeVisible();

  // Publishing needs a photo.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(message(page, /Before publishing: Add at least one photo\./)).toBeVisible();

  await page
    .locator("#photo-upload")
    .setInputFiles({ name: "site.jpg", mimeType: "image/jpeg", buffer: await photoWithGps() });
  await expect(message(page, "1 photo(s) added.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Cover photo")).toBeVisible();

  const service = serviceClient();
  const { data: images } = await service
    .from("property_images")
    .select("storage_path, width, height, is_cover")
    .eq("property_id", id);
  expect(images).toHaveLength(1);
  expect(images?.[0]).toMatchObject({ width: 2400, height: 1800, is_cover: true });
  const stored = await service.storage.from("property-media").download(images![0].storage_path);
  const metadata = await sharp(Buffer.from(await stored.data!.arrayBuffer())).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.exif).toBeUndefined();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(message(page, "Status changed to published.")).toBeVisible();

  const { data: listing } = await anonClient()
    .from("property_listings")
    .select("title, state, effective_price, discount_percent, description_html")
    .eq("id", id)
    .single();
  expect(listing).toMatchObject({ title, state: "Lagos", effective_price: 20_000_000, discount_percent: 20 });
  expect(listing?.description_html).toContain("Dry, fenced land");
});

test("possible duplicates are flagged and must be reviewed before publishing", async ({ page }) => {
  await signInAsAdmin(page, superAdmin);
  const title = uniqueText("E2E Twin Plot");
  await createLand(page, title, { location: "Ajah, Lagos" });
  await createLand(page, title, { location: "Ajah, Lagos" });

  await expect(page.getByText(/This looks like a possible duplicate of/)).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(message(page, "Review the possible duplicate before publishing.")).toBeVisible();

  await page.getByRole("button", { name: "Not a duplicate" }).click();
  await expect(message(page, "Marked as not a duplicate.")).toBeVisible();
  await expect(page.getByText(/This looks like a possible duplicate of/)).toHaveCount(0);
});

test("editors without publish permission can edit but not publish", async ({ page }) => {
  const editor = await createTestAdmin("props-editor", {
    permissions: { properties: { can_view: true, can_create: true, can_edit: true } },
  });
  await signInAsAdmin(page, editor);
  await createLand(page, uniqueText("E2E Editor Plot"));

  await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

  // Editing works and keeps a validation error next to its field.
  await page.getByLabel("Sales price (₦)").fill("30,000,000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("During a promotion the sales price must be lower than the regular price."),
  ).toBeVisible();
});

test("estates and CSV import: preview errors, then create drafts", async ({ page }) => {
  await signInAsAdmin(page, superAdmin);

  const estateName = `E2E Estate ${Date.now()}`;
  await page.goto("/admin/estates/new", { waitUntil: "networkidle" });
  await page.getByLabel("Estate name").fill(estateName);
  await page.getByRole("button", { name: "Save estate" }).click();
  await page.waitForURL(/\/admin\/estates\/[0-9a-f-]{36}\?created=1/);

  const good = uniqueText("E2E Imported Plot");
  const csv = [
    "title,purpose,state,location,estate,regular_price,land_size,land_size_unit",
    `${good},sale,Ogun,Mowe,${estateName},"8,500,000",2,plots`,
    `${uniqueText("E2E Bad Row")},sale,Texas,,,abc,,`,
  ].join("\n");

  await page.goto("/admin/properties/import", { waitUntil: "networkidle" });
  await page.getByLabel("Land", { exact: true }).check();
  await page.getByLabel("CSV file").setInputFiles({ name: "land.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Check file" }).click();
  await page.waitForURL(/\/admin\/properties\/import\/[0-9a-f-]{36}$/);

  await expect(page.getByText("state: “Texas” is not a Nigerian state.")).toBeVisible();
  await expect(page.getByText(/regular_price: Regular price must be a whole number/)).toBeVisible();

  await page.getByRole("button", { name: "Create drafts from ready rows" }).click();
  await page.waitForURL(/created=1/);
  await expect(message(page, /Import complete: 1 draft\(s\) created/)).toBeVisible();

  const { data } = await serviceClient()
    .from("properties")
    .select("id, status, state, land_size, land_size_unit, estate:estates(name)")
    .eq("title", good)
    .single();
  if (data) propertyIds.push(data.id);
  expect(data).toMatchObject({
    status: "draft",
    state: "Ogun",
    land_size: 2,
    land_size_unit: "plot",
    estate: { name: estateName },
  });
});
