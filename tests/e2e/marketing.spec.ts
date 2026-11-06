import { createHash, createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanup, serviceClient, sql, uniqueText } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Stage 11 part 1: top banner and announcement pop-up appear on the website; newsletter
 * double opt-in (sign-up, confirm, unsubscribe) with the dashboard list and CSV export;
 * property promotions switch on and off.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
const bannerText = `Open house this Saturday ${token}`;
const heading = `New estate launch ${token}`;
const subscriber = `rls-test-news-${token}@example.com`;
const propertyIds: string[] = [];
let admin: TestAdmin;
let property: { id: string; title: string };

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  await sql("delete from private.rate_limits where key like 'newsletter:%'");
  admin = await createTestAdmin("marketing-super", { role: "super_admin" });
  const { data, error } = await service
    .from("properties")
    .insert({
      kind: "land",
      purpose: "sale",
      status: "published",
      title: uniqueText(`Promo Plot ${token}`),
      state: "Lagos",
      regular_price: 10_000_000,
      sales_price: 8_000_000,
    } as never)
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);
  property = data;
  propertyIds.push(data.id);
});

test.afterAll(async () => {
  await service.from("top_banners").delete().like("message", `%${token}%`);
  await service.from("announcements").delete().like("heading", `%${token}%`);
  await service.from("newsletter_subscribers").delete().eq("email", subscriber);
  await cleanup(propertyIds);
});

test("banner and announcement are created in the dashboard and shown on the website", async ({ page, browser }) => {
  await signInAsAdmin(page, admin);

  await page.goto("/admin/marketing/banner", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add banner" }).click();
  await page.getByLabel(/^Message/).fill(bannerText);
  await page.getByLabel(/^Link \(optional\)|^Link$/).fill("/properties");
  await page.getByLabel(/^Link text/).fill("View listings");
  await page.locator("form").getByRole("button", { name: "Add banner" }).click();
  await expect(message(page, "Banner added.")).toBeVisible();
  await expect(page.getByText(bannerText)).toBeVisible();

  await page.goto("/admin/marketing/announcements", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add announcement" }).click();
  await page.getByLabel(/^Heading/).fill(heading);
  await page.getByLabel(/^Message/).fill("Plots from 5 million naira.");
  await page.getByLabel(/^Button text/).fill("See the estate");
  await page.getByLabel(/^Button link/).fill("/properties");
  await page.getByLabel(/^How often/).selectOption("once_per_session");
  await page.getByLabel(/^Priority/).fill("100");
  await page.locator("form").getByRole("button", { name: "Add announcement" }).click();
  await expect(message(page, "Announcement added.")).toBeVisible();

  // A brand-new visitor sees the banner and, after a moment, the pop-up.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/", { waitUntil: "networkidle" });
  await expect(visitor.getByRole("region", { name: "Site notice" })).toContainText(bannerText);
  const popup = visitor.getByRole("dialog", { name: heading });
  await expect(popup).toBeVisible({ timeout: 10_000 });
  await expect(popup.getByRole("link", { name: "See the estate" })).toHaveAttribute("href", "/properties");
  await popup.getByRole("button", { name: /close/i }).click();
  await expect(popup).toBeHidden();

  // Once per visit: not shown again on the next page.
  await visitor.goto("/about", { waitUntil: "networkidle" });
  await visitor.waitForTimeout(2500);
  await expect(visitor.getByRole("dialog", { name: heading })).toBeHidden();

  // Closing the banner hides it for the rest of the visit.
  await visitor.getByRole("button", { name: "Close notice" }).click();
  await expect(visitor.getByRole("region", { name: "Site notice" })).toHaveCount(0);
  await visitor.context().close();

  // Switch the pop-up off again (it would cover the page in the next tests).
  await page.goto("/admin/marketing/announcements", { waitUntil: "networkidle" });
  await page.getByRole("listitem").filter({ hasText: heading }).getByRole("button", { name: "Switch off" }).click();
  await expect(message(page, "The announcement is switched off.")).toBeVisible();

  // Switching the banner off removes it from the website.
  await page.goto("/admin/marketing/banner", { waitUntil: "networkidle" });
  await page.getByRole("listitem").filter({ hasText: bannerText }).getByRole("button", { name: "Switch off" }).click();
  await expect(message(page, "The banner is switched off.")).toBeVisible();
  const later = await (await browser.newContext()).newPage();
  await later.goto("/", { waitUntil: "networkidle" });
  await expect(later.getByText(bannerText)).toHaveCount(0);
  await later.context().close();
});

test("newsletter: sign up, confirm by email link, appear in the dashboard and export, unsubscribe", async ({
  page,
  browser,
}) => {
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/about", { waitUntil: "networkidle" });
  await visitor.getByLabel(/Property news and offers by email/).fill(subscriber);
  await visitor.getByRole("button", { name: "Subscribe" }).click();
  await expect(visitor.getByText("Check your inbox and click the link")).toBeVisible();

  const { data: row } = await service
    .from("newsletter_subscribers")
    .select("id, status")
    .eq("email", subscriber)
    .single();
  expect(row?.status).toBe("pending");

  // Emails are disabled in tests: give the pending row a known token, as the email would carry.
  const known = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "").slice(0, 12);
  await service
    .from("newsletter_subscribers")
    .update({ confirm_token_hash: createHash("sha256").update(known).digest("hex") })
    .eq("id", row!.id);
  await visitor.goto(`/newsletter/confirm?token=${known}`, { waitUntil: "networkidle" });
  await visitor.getByRole("button", { name: "Confirm subscription" }).click();
  await expect(visitor.getByText("Your subscription is confirmed.")).toBeVisible();

  // The same link cannot be used twice.
  await visitor.goto(`/newsletter/confirm?token=${known}`, { waitUntil: "networkidle" });
  await visitor.getByRole("button", { name: "Confirm subscription" }).click();
  await expect(visitor.getByText("has expired or was already used")).toBeVisible();

  await signInAsAdmin(page, admin);
  await page.goto("/admin/marketing/newsletter", { waitUntil: "networkidle" });
  await expect(page.getByRole("cell", { name: subscriber, exact: true })).toBeVisible();
  const csv = await page.request.get("/admin/marketing/newsletter/export");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(subscriber);

  // Unsubscribe link signed with the server secret; a tampered signature is refused.
  const sig = createHmac("sha256", process.env.ADMIN_OTP_HMAC_SECRET!)
    .update(`newsletter-unsubscribe:${row!.id}`)
    .digest("base64url")
    .slice(0, 32);
  await visitor.goto(`/newsletter/unsubscribe?id=${row!.id}&sig=${sig.replace(/^./, sig[0] === "A" ? "B" : "A")}`);
  await visitor.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(visitor.getByText("This unsubscribe link is not valid.")).toBeVisible();
  await visitor.goto(`/newsletter/unsubscribe?id=${row!.id}&sig=${sig}`, { waitUntil: "networkidle" });
  await visitor.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(visitor.getByText("You have been unsubscribed")).toBeVisible();
  const { data: after } = await service.from("newsletter_subscribers").select("status").eq("id", row!.id).single();
  expect(after?.status).toBe("unsubscribed");
  await visitor.context().close();
});

test("a property promotion is switched on and shows the discount on the website", async ({ page }) => {
  await signInAsAdmin(page, admin);
  await page.goto("/admin/marketing/promotions", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `Start promotion for ${property.title}` }).click();
  await expect(page.getByRole("button", { name: `End promotion for ${property.title}` })).toBeVisible();

  const { data } = await service
    .from("properties")
    .select("promotion_active, discount_percent, slug")
    .eq("id", property.id)
    .single();
  expect(data).toMatchObject({ promotion_active: true, discount_percent: 20 });

  // Property pages keep the Turnstile widget connected: wait for load, not network idle.
  await page.goto(`/properties/${data!.slug}`, { waitUntil: "load" });
  await expect(page.getByText("20%").first()).toBeVisible();

  await page.goto("/admin/marketing/promotions", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `End promotion for ${property.title}` }).click();
  await expect(page.getByRole("button", { name: `Start promotion for ${property.title}` })).toBeVisible();
});
