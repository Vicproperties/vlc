import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanup, RUN_ID, serviceClient } from "../integration/helpers";
import { createTestAdmin, recoveryToken, resetAdminRateLimits, type TestAdmin } from "./admin-fixtures";
import { message, signInAsAdmin } from "./session";

/**
 * Admin Users: a super admin invites an administrator (default access: website content and
 * blog), the invitee sets a password from the emailed link, signs in, sees only those
 * sections and publishes an article without approval; then the super admin removes access.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const service = serviceClient();
const token = randomUUID().slice(0, 8);
const inviteeEmail = `rls-test-e2e-invitee-${RUN_ID}@example.com`;
const inviteeName = `Invited Editor ${token}`;
const inviteePassword = `invitee passphrase ${token}`;
const articleTitle = `Sub admin article ${token}`;
let owner: TestAdmin;
let inviteeId = "";

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await resetAdminRateLimits();
  owner = await createTestAdmin("admins-owner", { role: "super_admin" });
});

test.afterAll(async () => {
  await service.from("blog_posts").delete().like("title", `%${token}%`);
  await cleanup([]);
});

test("a super admin invites an administrator with content and blog access", async ({ page }) => {
  await signInAsAdmin(page, owner);
  await page.getByRole("link", { name: "Admin Users" }).first().click();
  await expect(page.getByRole("heading", { name: "Admin users" })).toBeVisible();

  await page.getByRole("link", { name: "Invite administrator" }).click();
  await page.getByLabel("Full name").fill(inviteeName);
  await page.getByLabel("Email address").fill(inviteeEmail);

  // Default for a new administrator: website content and the blog, including publishing.
  await expect(page.getByRole("checkbox", { name: "Website content: Edit" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Blog: Publish" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Blog: Delete" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Properties: View" })).not.toBeChecked();

  await page.getByRole("button", { name: "Send invitation" }).click();
  const confirm = page.getByRole("dialog", { name: "Send the invitation?" });
  await expect(confirm).toContainText(inviteeEmail);
  await confirm.getByRole("button", { name: "Yes, send invitation" }).click();

  await page.waitForURL(/\/admin\/admins\/[0-9a-f-]{36}\?invited=1/, { timeout: 60_000 });
  await expect(message(page, `Invitation sent to ${inviteeEmail}`)).toBeVisible();
  inviteeId = page.url().match(/admins\/([0-9a-f-]{36})/)![1];

  const { data: perms } = await service
    .from("admin_permissions")
    .select("module, can_view, can_publish, can_delete")
    .eq("admin_id", inviteeId)
    .eq("can_view", true);
  expect(perms?.map((p) => p.module).sort()).toEqual(["blog", "content"]);
  expect(perms?.find((p) => p.module === "blog")).toMatchObject({ can_publish: true, can_delete: true });

  // The same email cannot be invited twice; a customer's email cannot become an admin.
  const customer = await createTestAdmin("admins-customer", { admin: false });
  for (const [email, error] of [
    [inviteeEmail, "This person is already an administrator."],
    [customer.email, "This email is already used by a customer account."],
  ]) {
    await page.goto("/admin/admins/new", { waitUntil: "networkidle" });
    await page.getByLabel("Full name").fill("Someone Else");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send invitation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes, send invitation" }).click();
    await expect(page.getByText(error)).toBeVisible();
  }
});

test("the invitee sets a password, signs in and publishes an article without approval", async ({ page }) => {
  await page.goto(`/admin/auth/confirm?token_hash=${await recoveryToken(inviteeEmail)}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/admin\/reset-password/);
  await page.getByLabel("New password", { exact: true }).fill(inviteePassword);
  await page.getByLabel("Confirm new password").fill(inviteePassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL(/\/admin\/login\?reason=password_updated/);

  await signInAsAdmin(page, { id: inviteeId, email: inviteeEmail, password: inviteePassword, name: inviteeName });
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Blog", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Website Content", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Properties" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Admin Users" })).toHaveCount(0);

  await page.goto("/admin/admins", { waitUntil: "networkidle" });
  await expect(page.getByText("You do not have access to this section")).toBeVisible();
  await page.goto("/admin/properties", { waitUntil: "networkidle" });
  await expect(page.getByText("You do not have access to this section")).toBeVisible();

  await page.goto("/admin/blog/new", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(articleTitle);
  await page.getByRole("textbox", { name: /^Summary/ }).fill("Written and published by an administrator.");
  await page.getByRole("textbox", { name: "Content" }).click();
  await page.keyboard.type("Published without waiting for a super administrator.");
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}\?created=1/, { timeout: 60_000 });

  const { data } = await service.from("blog_posts").select("status").eq("title", articleTitle).single();
  expect(data?.status).toBe("published");
});

test("removing access signs the administrator out; restoring it lets them back", async ({ browser, page }) => {
  const inviteeContext = await browser.newContext();
  const invitee = await inviteeContext.newPage();
  await signInAsAdmin(invitee, { id: inviteeId, email: inviteeEmail, password: inviteePassword, name: inviteeName });

  await signInAsAdmin(page, owner);
  await page.goto(`/admin/admins/${inviteeId}`, { waitUntil: "networkidle" });

  // Narrow their access: blog only.
  await page.getByRole("checkbox", { name: "Website content: View" }).uncheck();
  await expect(page.getByRole("checkbox", { name: "Website content: Edit" })).not.toBeChecked();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(message(page, "Changes saved.")).toBeVisible();
  await invitee.goto("/admin/content", { waitUntil: "networkidle" });
  await expect(invitee.getByText("You do not have access to this section")).toBeVisible();

  await page.getByRole("button", { name: "Remove access" }).click();
  await page
    .getByRole("dialog", { name: `Remove ${inviteeName}'s access?` })
    .getByRole("button", { name: "Remove access" })
    .click();
  await expect(message(page, "Access removed.")).toBeVisible();

  await invitee.goto("/admin/blog");
  await invitee.waitForURL(/\/admin\/login/);
  await inviteeContext.close();

  await page.getByRole("button", { name: "Restore access" }).click();
  await expect(message(page, "Access restored.")).toBeVisible();

  // A super admin cannot change or deactivate themselves from this page.
  await page.goto(`/admin/admins/${owner.id}`, { waitUntil: "networkidle" });
  await expect(page.getByText("This is your account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove access" })).toHaveCount(0);
});
