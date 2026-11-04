import { describe, expect, it } from "vitest";
import { generateOtp, hashIdentifier, hashOtp } from "@/features/auth/otp-core";
import { safeAdminPath } from "@/features/auth/redirects";
import { loginSchema, newPasswordSchema, otpSchema } from "@/features/auth/schemas";
import { escapeHtml, otpEmail, passwordLinkEmail } from "@/lib/email/templates";

describe("safeAdminPath", () => {
  it.each([
    ["/admin/properties", "/admin/properties"],
    ["/admin/properties/new", "/admin/properties/new"],
    ["/admin/properties?status=draft", "/admin/properties?status=draft"],
    ["/admin", "/admin"],
  ])("keeps dashboard path %s", (input, expected) => {
    expect(safeAdminPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "https://evil.com/admin",
    "/admin//evil.com",
    "/admin/../properties",
    "/admin\\evil",
    "/admin/%2e%2e/x",
    "/administrator",
    "/admin/",
    "/admin/login",
    "/admin/verify",
    "/properties",
    "",
    undefined,
    42,
    `/admin/${"a".repeat(300)}`,
  ])("rejects %s", (input) => {
    expect(safeAdminPath(input)).toBe("/admin");
  });

  it("drops unsafe query strings but keeps the path", () => {
    expect(safeAdminPath("/admin/blog?x=<script>")).toBe("/admin/blog");
  });
});

describe("one-time codes", () => {
  it("are six digits and vary", () => {
    const codes = new Set(Array.from({ length: 200 }, generateOtp));
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(codes.size).toBeGreaterThan(190);
  });

  it("hash deterministically, bound to the session and the secret", () => {
    const a = hashOtp("secret-1", "session-1", "123456");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp("secret-1", "session-1", "123456")).toBe(a);
    expect(hashOtp("secret-1", "session-2", "123456")).not.toBe(a);
    expect(hashOtp("secret-2", "session-1", "123456")).not.toBe(a);
  });

  it("identifier hashes ignore case and whitespace and differ per kind", () => {
    expect(hashIdentifier("s", "email", " Owner@Example.com ")).toBe(hashIdentifier("s", "email", "owner@example.com"));
    expect(hashIdentifier("s", "email", "x")).not.toBe(hashIdentifier("s", "ip", "x"));
  });
});

describe("auth form validation", () => {
  it("normalises the email address", () => {
    const parsed = loginSchema.parse({ email: "  Owner@Example.COM ", password: "x" });
    expect(parsed.email).toBe("owner@example.com");
  });

  it("accepts codes typed with spaces or dashes", () => {
    expect(otpSchema.parse({ code: "123 456" }).code).toBe("123456");
    expect(otpSchema.parse({ code: "123-456" }).code).toBe("123456");
    expect(otpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });

  it("enforces the password policy", () => {
    const ok = (password: string, confirm = password) => newPasswordSchema.safeParse({ password, confirm }).success;
    expect(ok("a long and memorable phrase")).toBe(true);
    expect(ok("short")).toBe(false);
    expect(ok("aaaaaaaaaaaaaaaa")).toBe(false);
    expect(ok(" leading space phrase")).toBe(false);
    expect(ok("x".repeat(40) + "abcdefghij".repeat(4))).toBe(false); // over 72 bytes
    expect(ok("a long and memorable phrase", "different")).toBe(false);
  });
});

describe("email templates", () => {
  it("escape every dynamic value", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    const email = otpEmail({ name: "<img src=x>", code: "123456", minutes: 10 });
    expect(email.html).not.toContain("<img src=x>");
    expect(email.html).toContain("123456");
    expect(email.text).toContain("123456");
  });

  it("include the link in both versions", () => {
    const link = "http://localhost:3000/admin/auth/confirm?token_hash=abc&x=1";
    const email = passwordLinkEmail({ name: "Owner", link, kind: "reset" });
    expect(email.html).toContain("token_hash=abc&amp;x=1");
    expect(email.text).toContain(link);
    expect(passwordLinkEmail({ name: "Owner", link, kind: "invite" }).subject).toMatch(/Set up/);
  });
});
