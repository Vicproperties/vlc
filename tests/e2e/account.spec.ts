import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanup, serviceClient, uniqueText } from "../integration/helpers";
import { createTestCustomer, signInAsCustomer, type TestCustomer } from "./customer-fixtures";
import { message } from "./session";

/**
 * Stage 10: customer accounts. Signed-out visitors are asked to sign in; signed-in customers save
 * favourites with the heart, see them in their account, edit their profile and delete the account.
 */
test.describe.configure({ mode: "serial", timeout: 180_000 });

const BASE = "http://localhost:3100";
const service = serviceClient();
const token = randomUUID().slice(0, 8);
const propertyIds: string[] = [];
let property: { id: string; slug: string; title: string };
let customer: TestCustomer;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const { data, error } = await service
    .from("properties")
    .insert({
      kind: "land",
      purpose: "sale",
      status: "published",
      title: uniqueText(`Favourite Plot ${token}`),
      state: "Lagos",
    } as never)
    .select("id, slug, title")
    .single();
  if (error) throw new Error(error.message);
  property = data;
  propertyIds.push(data.id);
  customer = await createTestCustomer("acct");
});

test.afterAll(async () => {
  await cleanup(propertyIds);
});

test("signed-out visitors are sent to sign in, keeping the property to save", async ({ page }) => {
  await page.goto("/account/favourites", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount%2Ffavourites/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  await page.getByRole("button", { name: `Save ${property.title} to favourites` }).click();
  await expect(page).toHaveURL(new RegExp(`/account/login\\?next=.*&favourite=${property.id}`));
  await expect(page.getByText("Sign in to save this property to your favourites.")).toBeVisible();

  // Open redirects are refused.
  await page.goto("/account/login?next=//evil.example", { waitUntil: "load" });
  await expect(page.locator('input[name="next"]')).toHaveValue("/account");
});

test("customers save favourites, edit their profile and see their account", async ({ page, context }) => {
  await signInAsCustomer(context, customer, BASE);

  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  const save = page.getByRole("button", { name: `Save ${property.title} to favourites` });
  await save.click();
  await expect(page.getByRole("button", { name: `Remove ${property.title} from favourites` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => (await service.from("favourites").select("property_id").eq("customer_id", customer.id)).data)
    .toEqual([{ property_id: property.id }]);

  await page.goto("/account/favourites", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "My favourites" })).toBeVisible();
  await expect(page.getByRole("link", { name: property.title }).first()).toBeVisible();

  await page.goto("/account", { waitUntil: "load" });
  await page.getByRole("textbox", { name: /^Full name/ }).fill("Ada Customer");
  await page.getByRole("textbox", { name: /^Phone number/ }).fill("0803 123 4567");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(message(page, "Profile saved")).toBeVisible();
  const { data: profile } = await service.from("customer_profiles").select("full_name, phone").eq("id", customer.id).single();
  expect(profile).toEqual({ full_name: "Ada Customer", phone: "+2348031234567" });

  await page.goto("/account/inspections", { waitUntil: "load" });
  await expect(page.getByText("No inspection requests yet")).toBeVisible();

  // Customers have no dashboard access.
  await page.goto("/admin", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/admin$/);
});

test("customers can delete their account", async ({ page, context }) => {
  await signInAsCustomer(context, customer, BASE);
  await page.goto("/account/settings", { waitUntil: "load" });
  await page.getByRole("button", { name: "Delete my account" }).click();
  // Wait for the validation error (not the label) so the form reset has happened before typing.
  await expect(page.getByText("Type DELETE to confirm.", { exact: true })).toBeVisible();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL(/account_deleted=1/);

  const { data } = await service.auth.admin.getUserById(customer.id);
  expect(data.user).toBeNull();
  const favs = await service.from("favourites").select("property_id").eq("customer_id", customer.id);
  expect(favs.data).toEqual([]);
});
