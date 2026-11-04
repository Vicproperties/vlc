import { expect, test, type Page } from "@playwright/test";
import { cleanup } from "../integration/helpers";
import {
  ageAdminSessions,
  createTestAdmin,
  recoveryToken,
  resetAdminRateLimits,
  setKnownCode,
  type TestAdmin,
} from "./admin-fixtures";

/**
 * Admin sign-in journey through the real UI and the development database:
 * password -> emailed code -> dashboard, plus every failure path.
 */
test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async () => {
  await resetAdminRateLimits();
});

test.afterAll(async () => {
  await cleanup([]);
});

/** Our alerts only — Next.js also renders an (empty) role="alert" route announcer. */
function alert(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Sign-in code").fill(code);
  const submitted = page.waitForResponse((res) => res.request().method() === "POST");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await submitted;
}

async function fullSignIn(page: Page, admin: TestAdmin) {
  await signIn(page, admin.email, admin.password);
  await page.waitForURL(/\/admin\/verify/);
  await page.waitForLoadState("networkidle");
  await enterCode(page, await setKnownCode(admin.id));
}

test("signed-out visitors are sent to sign in, keeping the destination", async ({ page }) => {
  await page.goto("/admin/properties");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fproperties$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong passwords and non-admin accounts get the same generic error", async ({ page }) => {
  const admin = await createTestAdmin("wrongpw");
  const customer = await createTestAdmin("notadmin", { admin: false });

  await signIn(page, admin.email, "not the right password");
  await expect(alert(page, "The email or password is incorrect.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(admin.email);

  await signIn(page, customer.email, customer.password);
  await expect(alert(page, "The email or password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("password + emailed code opens a permission-aware dashboard; sign-out ends it", async ({ page }) => {
  const admin = await createTestAdmin("journey", { view: ["properties"] });

  await signIn(page, admin.email, admin.password);
  await page.waitForURL(/\/admin\/verify/);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // The dashboard stays closed until the code is entered.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/verify/);

  await enterCode(page, "000000");
  await expect(page.getByText("That code is incorrect. Check the most recent email.")).toBeVisible();

  await enterCode(page, await setKnownCode(admin.id));
  await page.waitForURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: `Welcome, Tester` })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Dashboard" });
  await expect(nav.getByRole("link", { name: "Properties" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin Users" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Blog" })).toHaveCount(0);

  // Already verified: the code page sends you to the dashboard.
  await page.goto("/admin/verify");
  await page.waitForURL(/\/admin$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/admin\/login\?reason=signed_out/);
  await expect(page.getByRole("status")).toHaveText("You have signed out.");

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the original destination is restored after sign-in", async ({ page }) => {
  const admin = await createTestAdmin("next", { view: ["properties"] });
  await page.goto("/admin/properties");
  await page.waitForURL(/\/admin\/login\?next=/);
  await page.getByLabel("Email address").fill(admin.email);
  await page.getByLabel("Password", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/admin\/verify\?next=%2Fadmin%2Fproperties/);
  await enterCode(page, await setKnownCode(admin.id));
  await page.waitForURL(/\/admin\/properties$/);
});

test("five wrong codes lock the login", async ({ page }) => {
  const admin = await createTestAdmin("lockout");
  await signIn(page, admin.email, admin.password);
  await page.waitForURL(/\/admin\/verify/);
  await page.waitForLoadState("networkidle");
  const codeError = page.getByText("That code is incorrect.", { exact: false });
  const codeInput = page.getByLabel("Sign-in code");
  for (let i = 0; i < 4; i += 1) {
    await enterCode(page, `11111${i}`);
    // React clears the form once the result is applied; typing before that would be wiped.
    await expect(codeInput).toHaveValue("");
    await expect(codeError).toBeVisible();
  }
  await enterCode(page, "111119");
  await page.waitForURL(/\/admin\/login\?reason=locked/);
  await expect(alert(page, "Too many incorrect codes")).toBeVisible();
});

test("idle sessions expire after 30 minutes", async ({ page }) => {
  const admin = await createTestAdmin("idle");
  await fullSignIn(page, admin);
  await page.waitForURL(/\/admin$/);

  await ageAdminSessions(admin.id, 31);
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login\?reason=expired/);
  await expect(page.getByRole("status")).toContainText("Your session has ended");
});

test("forgot password never reveals whether an account exists", async ({ page }) => {
  const admin = await createTestAdmin("forgot");
  const expected = "If an administrator account uses that email, a link to reset the password is on its way.";

  for (const email of [admin.email, "nobody-here@example.com"]) {
    await page.goto("/admin/forgot-password", { waitUntil: "networkidle" });
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText(expected);
  }
});

test("password reset: link -> new password -> all sessions signed out -> sign in again", async ({ page, browser }) => {
  const admin = await createTestAdmin("reset");

  // Another device already signed in.
  const otherDevice = await browser.newPage();
  await fullSignIn(otherDevice, admin);
  await otherDevice.waitForURL(/\/admin$/);

  await page.goto(`/admin/auth/confirm?token_hash=${await recoveryToken(admin.email)}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/admin\/reset-password/);

  await page.getByLabel("New password", { exact: true }).fill("a brand new passphrase");
  await page.getByLabel("Confirm new password").fill("something else entirely");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("The passwords do not match.")).toBeVisible();

  const newPassword = "a brand new passphrase 2026";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL(/\/admin\/login\?reason=password_updated/);

  // The other device lost its session.
  await otherDevice.goto("/admin");
  await otherDevice.waitForURL(/\/admin\/login/);
  await otherDevice.close();

  // The old password no longer works; the new one does (and still needs a code).
  await signIn(page, admin.email, admin.password);
  await expect(alert(page, "The email or password is incorrect.")).toBeVisible();
  await signIn(page, admin.email, newPassword);
  await page.waitForURL(/\/admin\/verify/);
});

test("used or invalid password links are rejected", async ({ page }) => {
  await page.goto("/admin/auth/confirm?token_hash=0000000000000000000000000000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(alert(page, "This link is invalid or has expired.")).toBeVisible();

  await page.goto("/admin/reset-password");
  await expect(alert(page, "invalid or has expired")).toBeVisible();
});
