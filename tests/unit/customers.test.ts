import { describe, expect, it } from "vitest";
import { CUSTOMER_HOME, carriedParams, carriedQuery, safeCustomerPath } from "@/features/customers/redirects";
import { TOKEN_HASH, changePasswordSchema, registerSchema } from "@/features/customers/auth-schemas";

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

describe("carriedParams / carriedQuery", () => {
  const id = "0b5c7a52-2f8e-4a51-9a0e-8a4f2d7c9b11";
  it("keeps a safe next path and a valid property id", () => {
    expect(carriedParams({ next: "/properties/x", favourite: id })).toEqual({ next: "/properties/x", favourite: id });
    expect(carriedQuery({ next: "/properties/x", favourite: id })).toBe(`?next=%2Fproperties%2Fx&favourite=${id}`);
  });
  it("drops unsafe values", () => {
    expect(carriedParams({ next: "//evil.example", favourite: "1 or 1=1" })).toEqual({
      next: CUSTOMER_HOME,
      favourite: null,
    });
    expect(carriedQuery({ next: CUSTOMER_HOME, favourite: null })).toBe("");
  });
});

describe("customer auth schemas", () => {
  const base = {
    full_name: "Ada Obi",
    email: " Ada@Example.com ",
    password: "harbour lights 7",
    confirm: "harbour lights 7",
  };
  it("accepts a valid registration and normalises the email", () => {
    const result = registerSchema.safeParse(base);
    expect(result.success && result.data.email).toBe("ada@example.com");
  });
  it.each([
    ["short password", { password: "short7", confirm: "short7" }, "password"],
    ["repetitive password", { password: "aaaaaaaab", confirm: "aaaaaaaab" }, "password"],
    ["leading space", { password: " harbour lights", confirm: " harbour lights" }, "password"],
    ["mismatch", { confirm: "something else 1" }, "confirm"],
    ["bad email", { email: "not-an-email" }, "email"],
    ["missing name", { full_name: " " }, "full_name"],
  ])("rejects %s", (_label, change, field) => {
    const result = registerSchema.safeParse({ ...base, ...change });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.path[0])).toContain(field);
  });
  it("change password needs the current password and a matching new one", () => {
    expect(
      changePasswordSchema.safeParse({ current: "", password: "harbour lights 7", confirm: "harbour lights 7" })
        .success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ current: "old one", password: "harbour lights 7", confirm: "harbour lights 7" })
        .success,
    ).toBe(true);
  });
  it("token hashes are restricted to URL-safe characters", () => {
    expect(TOKEN_HASH.test("pkce_0123456789abcdef")).toBe(true);
    expect(TOKEN_HASH.test("abc<script>defghij")).toBe(false);
  });
});
