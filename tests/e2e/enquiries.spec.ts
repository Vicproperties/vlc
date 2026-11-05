import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, serviceClient, uniqueText } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits, resetEnquiryRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Stage 7: visitor inspection requests and contact messages, then staff handling them.
 * The app runs with Cloudflare's Turnstile test keys (always pass) in development.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const propertyIds: string[] = [];
const token = randomUUID().slice(0, 8);
let property: { id: string; slug: string; title: string };
let staff: TestAdmin;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  await resetEnquiryRateLimits();
  const { data, error } = await service
    .from("properties")
    .insert({
      kind: "land",
      purpose: "sale",
      status: "published",
      title: uniqueText(`Inspection Plot ${token}`),
      state: "Lagos",
    } as never)
    .select("id, slug, title")
    .single();
  if (error) throw new Error(error.message);
  property = data;
  propertyIds.push(data.id);
  staff = await createTestAdmin("enq-staff", {
    permissions: { inspections: { can_view: true, can_edit: true }, enquiries: { can_view: true, can_edit: true } },
  });
});

test.afterAll(async () => {
  await service.from("contact_submissions").delete().like("message", `%${token}%`);
  await cleanup(propertyIds);
});

async function passTurnstile(page: Page) {
  // The test widget solves itself and writes the token into the form.
  await expect(page.locator('input[name="cf-turnstile-response"]').first()).toHaveValue(/.+/, { timeout: 30_000 });
}

test("visitors request an inspection; the confirmation can be reopened", async ({ page }) => {
  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Request an inspection" }) });

  // Validation messages appear next to the fields.
  await passTurnstile(page);
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(form.getByText("Enter your full name.")).toBeVisible();
  await expect(form.getByText(/Please agree so that we can contact you/)).toBeVisible();

  await form.getByLabel("Full name").fill("Ada Obi");
  await form.getByRole("textbox", { name: "Phone number" }).fill("0803 123 4567");
  await form.getByLabel("Preferred time").selectOption("morning");
  await form.getByLabel("Message").fill(`Saturday works best ${token}`);
  await form.getByRole("checkbox").check();
  await passTurnstile(page);
  await form.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText("Inspection request received")).toBeVisible();
  const reference = (await page.locator("strong.font-mono").first().textContent())?.trim();
  expect(reference).toMatch(/^[0-9A-F]{8}$/);

  const { data } = await service
    .from("inspection_requests")
    .select("id, phone, status, preferred_time, consent_at")
    .eq("property_id", property.id)
    .single();
  expect(data).toMatchObject({ phone: "+2348031234567", status: "pending", preferred_time: "morning" });
  expect(data?.consent_at).not.toBeNull();
  expect(data?.id.replace(/-/g, "").slice(0, 8).toUpperCase()).toBe(reference);

  // Reopen the page: the confirmation is remembered on this device.
  await page.reload({ waitUntil: "load" });
  await expect(page.getByText(`Your reference is`)).toBeVisible();
  await page.getByRole("button", { name: "Make another request" }).click();
  await expect(page.getByRole("heading", { name: "Request an inspection" })).toBeVisible();
});

test("bots that fill the hidden field get a normal reply but nothing is saved", async ({ page }) => {
  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Request an inspection" }) });
  await form.getByLabel("Full name").fill("Bot Name");
  await form.getByRole("textbox", { name: "Phone number" }).fill("0803 765 4321");
  await form.getByRole("checkbox").check();
  await page.locator("#inspect-website").evaluate((input: HTMLInputElement) => (input.value = "https://spam.example"));
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Inspection request received")).toBeVisible();

  const { count } = await service
    .from("inspection_requests")
    .select("id", { count: "exact", head: true })
    .eq("property_id", property.id)
    .eq("full_name", "Bot Name");
  expect(count).toBe(0);
});

test("staff confirm the request with a note recorded in its history", async ({ page }) => {
  await signInAsAdmin(page, staff);
  await expect(page.getByText("Pending inspection requests")).toBeVisible();
  await page.goto("/admin/inspections", { waitUntil: "load" });
  await page.getByRole("link", { name: "Ada Obi" }).first().click();
  await page.waitForURL(/\/admin\/inspections\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: property.title })).toBeVisible();

  await page.getByLabel("Status", { exact: true }).selectOption("confirmed");
  await page.getByLabel(/Note for the history/).fill("Booked for Saturday 10am");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(message(page, "Status updated.")).toBeVisible();
  await expect(page.getByText("Pending → Confirmed")).toBeVisible();
  await expect(page.getByText("Booked for Saturday 10am")).toBeVisible();
});

test("contact messages reach the inbox, are marked read when opened, and can be archived", async ({ page }) => {
  const subject = `Question ${token}`;
  await page.goto("/contact", { waitUntil: "load" });
  await page.getByLabel("Full name").fill("Chidi Okafor");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("chidi@example.com");
  await page.getByLabel("Subject").fill(subject);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(`Do you have land in Ibeju-Lekki? ${token}`);
  await page.getByRole("checkbox").check();
  await passTurnstile(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Thank you. Your message has been sent.")).toBeVisible();

  await signInAsAdmin(page, staff);
  await page.goto("/admin/inspections/messages", { waitUntil: "load" });
  await page.getByRole("link", { name: "Chidi Okafor" }).first().click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();

  const { data } = await service.from("contact_submissions").select("is_read").eq("subject", subject).single();
  expect(data?.is_read).toBe(true);

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(message(page, "Message archived.")).toBeVisible();
  await page.goto("/admin/inspections/messages?box=archived", { waitUntil: "load" });
  await expect(page.getByText(subject)).toBeVisible();
});
