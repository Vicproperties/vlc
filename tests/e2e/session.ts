import { expect, type Page } from "@playwright/test";
import { setKnownCode, type TestAdmin } from "./admin-fixtures";

/** Full dashboard sign-in (password + code) through the real UI. */
export async function signInAsAdmin(page: Page, admin: TestAdmin) {
  await page.goto("/admin/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(admin.email);
  await page.getByLabel("Password", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/admin\/verify/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Sign-in code").fill(await setKnownCode(admin.id));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/admin$/);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

/** Our messages only — Next.js also renders an empty role="alert" route announcer. */
export function message(page: Page, text: string | RegExp) {
  return page.locator('[role="status"], [role="alert"]').filter({ hasText: text });
}
