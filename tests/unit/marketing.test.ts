import { describe, expect, it } from "vitest";
import { formatConsent, parseConsent } from "@/features/cookies/consent";
import { DEFAULT_SUB_ADMIN_PERMISSIONS, MANAGED_MODULES, permissionsFromForm } from "@/features/admins/permissions";

const ID = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

describe("cookie consent value", () => {
  it("round-trips a choice", () => {
    const consent = { version: "2", analytics: true, anonId: ID };
    expect(parseConsent(formatConsent(consent))).toEqual(consent);
    expect(parseConsent(formatConsent({ ...consent, analytics: false }))?.analytics).toBe(false);
  });

  it("rejects missing, malformed or tampered values", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("1.yes." + ID)).toBeNull();
    expect(parseConsent("1.1.not-a-uuid")).toBeNull();
    expect(parseConsent(`${"9".repeat(21)}.1.${ID}`)).toBeNull();
  });
});

describe("admin permissions form", () => {
  it("defaults let a new administrator run website content and the blog, including publishing", () => {
    expect(DEFAULT_SUB_ADMIN_PERMISSIONS.blog).toMatchObject({ view: true, create: true, publish: true, delete: true });
    expect(DEFAULT_SUB_ADMIN_PERMISSIONS.content).toMatchObject({ view: true, edit: true });
  });

  it("accepts only listed sections and actions, and any action implies view", () => {
    const form = new FormData();
    form.set("perm.blog.publish", "on");
    form.set("perm.settings.publish", "on"); // not an action of settings
    form.set("perm.admins.view", "on"); // never assignable
    form.set("perm.analytics.view", "on");
    const result = permissionsFromForm(form);
    expect(result).toEqual({ blog: { publish: true, view: true }, analytics: { view: true } });
    expect(MANAGED_MODULES.some((m) => m.module === "admins")).toBe(false);
  });
});
