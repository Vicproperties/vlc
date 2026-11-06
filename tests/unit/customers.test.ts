import { describe, expect, it } from "vitest";
import { CUSTOMER_HOME, safeCustomerPath } from "@/features/customers/redirects";

describe("safeCustomerPath", () => {
  it("keeps same-site public paths", () => {
    expect(safeCustomerPath("/properties/plot-in-lekki")).toBe("/properties/plot-in-lekki");
    expect(safeCustomerPath("/account/favourites")).toBe("/account/favourites");
    expect(safeCustomerPath("/properties?state=Lagos&page=2")).toBe("/properties?state=Lagos&page=2");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["absolute URL", "https://evil.example/"],
    ["backslash trick", "/\\evil.example"],
    ["javascript", "javascript:alert(1)"],
    ["dashboard", "/admin"],
    ["dashboard page", "/admin/properties"],
    ["dashboard query", "/admin?x=1"],
    ["auth callback loop", "/auth/callback?next=/"],
    ["traversal", "/account/../admin"],
    ["no leading slash", "account"],
    ["empty", ""],
    ["non-string", 42],
    ["too long", `/${"a".repeat(400)}`],
  ])("refuses %s", (_label, value) => {
    expect(safeCustomerPath(value)).toBe(CUSTOMER_HOME);
  });

  it("does not mistake /administration-style public paths for the dashboard", () => {
    expect(safeCustomerPath("/administrative-plots")).toBe("/administrative-plots");
  });
});
