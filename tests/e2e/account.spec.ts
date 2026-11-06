import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, serviceClient, uniqueText } from "../integration/helpers";
import { createTestAdmin, resetAdminRateLimits } from "./admin-fixtures";
import {
  createTestCustomer,
  customerEmail,
  customerPassword,
  emailLinkToken,
  resetCustomerRateLimits,
  type TestCustomer,
} from "./customer-fixtures";
import { message } from "./session";

/**
 * Stage 10: customer accounts with email and password. Registration needs email verification;
 * sign-in, forgot/reset and change password; favourites; staff accounts refused; deletion.
 * Emails are not delivered in tests (EMAIL_TRANSPORT=disabled): link tokens come from Supabase.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
const propertyIds: string[] = [];
let property: { id: string; slug: string; title: string };
let customer: TestCustomer;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetCustomerRateLimits();
  await resetAdminRateLimits();
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

async function passTurnstile(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]').first()).toHaveValue(/.+/, { timeout: 30_000 });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/account/login", { waitUntil: "load" });
  await page.getByRole("textbox", { name: /^Email address/ }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("signed-out visitors are sent to sign in, keeping the property to save", async ({ page }) => {
  await page.goto("/account/favourites", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount%2Ffavourites/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  await page.getByRole("button", { name: `Save ${property.title} to favourites` }).click();
  await expect(page).toHaveURL(new RegExp(`/account/login\\?next=.*&favourite=${property.id}`));
  await expect(page.getByText("Sign in to save this property to your favourites.")).toBeVisible();
  // The property is carried over to registration too.
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    new RegExp(`favourite=${property.id}`),
  );

  // Open redirects are refused.
  await page.goto("/account/login?next=//evil.example", { waitUntil: "load" });
  await expect(page.locator('input[name="next"]')).toHaveValue("/account");
});

test("register, verify the email, and the hearted property is saved", async ({ page }) => {
  const email = customerEmail("register");
  const password = customerPassword();

  await page.goto(
    `/account/register?favourite=${property.id}&next=${encodeURIComponent(`/properties/${property.slug}`)}`,
    {
      waitUntil: "load",
    },
  );
  // Validation
  await passTurnstile(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();

  await page.getByRole("textbox", { name: /^Full name/ }).fill("Ada Register");
  await page.getByRole("textbox", { name: /^Email address/ }).fill(email);
  await page
    .getByLabel(/^Password/)
    .first()
    .fill(password);
  await page.getByLabel(/^Confirm password/).fill(password);
  await passTurnstile(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const { data: userId } = await service.rpc("customer_id_for_email", { p_email: email });
  expect(userId).toBeTruthy();
  const { data: user } = await service.auth.admin.getUserById(userId!);
  expect(user.user?.email_confirmed_at ?? null).toBeNull();
  const { data: profile } = await service.from("customer_profiles").select("full_name").eq("id", userId!).single();
  expect(profile?.full_name).toBe("Ada Register");

  // Not verified yet: sign-in is refused with an offer to resend the link.
  await signIn(page, email, password);
  await expect(message(page, /not verified yet/)).toBeVisible();
  await page.getByRole("button", { name: "Send a new activation link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // The emailed link: one click activates the account and signs in.
  const hash = await emailLinkToken(email, "magiclink");
  await page.goto(
    `/account/verify?token_hash=${hash}&favourite=${property.id}&next=${encodeURIComponent(`/properties/${property.slug}`)}`,
    { waitUntil: "load" },
  );
  await page.getByRole("button", { name: "Activate account" }).click();
  await page.waitForURL(new RegExp(`/properties/${property.slug}$`));
  await expect(page.getByRole("button", { name: `Remove ${property.title} from favourites` })).toBeVisible();
  const favs = await service.from("favourites").select("property_id").eq("customer_id", userId!);
  expect(favs.data).toEqual([{ property_id: property.id }]);

  // The link cannot be used again.
  await page.context().clearCookies();
  await page.goto(`/account/verify?token_hash=${hash}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Activate account" }).click();
  await expect(message(page, /invalid or has expired/)).toBeVisible();
});

test("sign in, wrong password, and staff accounts are refused", async ({ page }) => {
  await signIn(page, customer.email, "not the password");
  await expect(message(page, "The email or password is incorrect.")).toBeVisible();

  const staff = await createTestAdmin("cust-staff");
  await signIn(page, staff.email, staff.password);
  await expect(message(page, "The email or password is incorrect.")).toBeVisible();

  await signIn(page, customer.email, customer.password);
  await page.waitForURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();

  // Customers have no dashboard access.
  await page.goto("/admin", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/admin$/);
});

test("forgot password: the emailed link sets a new password and signs out everywhere", async ({ page }) => {
  await page.goto("/account/forgot-password", { waitUntil: "load" });
  await page.getByRole("textbox", { name: /^Email address/ }).fill(customer.email);
  await passTurnstile(page);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Without a fresh link the form is not offered.
  await page.goto("/account/reset-password", { waitUntil: "load" });
  await expect(message(page, /invalid or has expired/)).toBeVisible();

  const hash = await emailLinkToken(customer.email, "recovery");
  await page.goto(`/account/reset-password?token_hash=${hash}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/account\/reset-password$/);
  const newPassword = customerPassword();
  await page.getByLabel(/^New password/).fill(newPassword);
  await page.getByLabel(/^Confirm new password/).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await page.waitForURL(/reason=password_updated/);
  await expect(message(page, /Your password has been changed/)).toBeVisible();

  await signIn(page, customer.email, customer.password);
  await expect(message(page, "The email or password is incorrect.")).toBeVisible();
  customer.password = newPassword;
  await signIn(page, customer.email, customer.password);
  await page.waitForURL(/\/account$/);
});

test("profile, favourites, change password, sign out and delete", async ({ page }) => {
  await signIn(page, customer.email, customer.password);
  await page.waitForURL(/\/account$/);

  await page.getByRole("textbox", { name: /^Full name/ }).fill("Ada Customer");
  await page.getByRole("textbox", { name: /^Phone number/ }).fill("0803 123 4567");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(message(page, "Profile saved")).toBeVisible();
  const { data: profile } = await service
    .from("customer_profiles")
    .select("full_name, phone")
    .eq("id", customer.id)
    .single();
  expect(profile).toEqual({ full_name: "Ada Customer", phone: "+2348031234567" });

  await page.goto(`/properties/${property.slug}`, { waitUntil: "load" });
  await page.getByRole("button", { name: `Save ${property.title} to favourites` }).click();
  await expect(page.getByRole("button", { name: `Remove ${property.title} from favourites` })).toBeVisible();
  await page.goto("/account/favourites", { waitUntil: "load" });
  await expect(page.getByRole("link", { name: property.title }).first()).toBeVisible();

  await page.goto("/account/inspections", { waitUntil: "load" });
  await expect(page.getByText("No inspection requests yet")).toBeVisible();

  // Change password (current password required).
  await page.goto("/account/settings", { waitUntil: "load" });
  const changed = customerPassword();
  await page.getByLabel(/^Current password/).fill("wrong current");
  await page.getByLabel(/^New password/).fill(changed);
  await page.getByLabel(/^Confirm new password/).fill(changed);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password is incorrect.")).toBeVisible();
  await page.getByLabel(/^Current password/).fill(customer.password);
  await page.getByLabel(/^New password/).fill(changed);
  await page.getByLabel(/^Confirm new password/).fill(changed);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(message(page, /Password changed/)).toBeVisible();
  customer.password = changed;

  // Sign out, then back in with the changed password.
  await page.getByRole("main").getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL(/signed_out=1/);
  await signIn(page, customer.email, customer.password);
  await page.waitForURL(/\/account$/);

  // Delete the account.
  await page.goto("/account/settings", { waitUntil: "load" });
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Type DELETE to confirm.", { exact: true })).toBeVisible();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL(/account_deleted=1/);
  const { data } = await service.auth.admin.getUserById(customer.id);
  expect(data.user).toBeNull();
});
