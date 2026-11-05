import { describe, expect, it } from "vitest";
import { contactSchema, inspectionSchema, lagosToday, requestReference } from "@/features/enquiries/schemas";
import { parsePhoneStrict } from "@/features/enquiries/server";

describe("inspection request validation", () => {
  const today = "2026-11-05";
  const schema = inspectionSchema(today);
  const base = { full_name: "Ada Obi", email: "", preferred_date: "", preferred_time: "", message: "", consent: "on" };

  it("accepts a minimal request", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("requires consent", () => {
    const result = schema.safeParse({ ...base, consent: "" });
    expect(result.success).toBe(false);
  });

  it("accepts today and dates within 6 months only", () => {
    expect(schema.safeParse({ ...base, preferred_date: today }).success).toBe(true);
    expect(schema.safeParse({ ...base, preferred_date: "2026-11-04" }).success).toBe(false);
    expect(schema.safeParse({ ...base, preferred_date: "2027-06-30" }).success).toBe(false);
    expect(schema.safeParse({ ...base, preferred_date: "05/11/2026" }).success).toBe(false);
  });

  it("only accepts listed times and rejects markup in names", () => {
    expect(schema.safeParse({ ...base, preferred_time: "midnight" }).success).toBe(false);
    expect(schema.safeParse({ ...base, preferred_time: "morning" }).success).toBe(true);
    expect(schema.safeParse({ ...base, full_name: "<script>x</script>" }).success).toBe(false);
  });

  it("uses Lagos calendar days", () => {
    // 23:30 UTC on 4 Nov is already 5 Nov in Lagos (UTC+1).
    expect(lagosToday(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
  });
});

describe("contact message validation", () => {
  it("requires name, email, message and consent", () => {
    const ok = contactSchema.safeParse({
      name: "Ada",
      email: "ADA@Example.com",
      subject: "",
      message: "Hello",
      consent: "on",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("ada@example.com");
    expect(
      contactSchema.safeParse({ name: "Ada", email: "bad", subject: "", message: "Hello", consent: "on" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ name: "Ada", email: "a@b.co", subject: "", message: "", consent: "on" }).success,
    ).toBe(false);
  });
});

describe("phone numbers (server, full metadata)", () => {
  it("accepts Nigerian local and international formats", () => {
    expect(parsePhoneStrict("0803 123 4567", "NG")).toEqual({ ok: true, e164: "+2348031234567" });
    expect(parsePhoneStrict("+44 20 7946 0958", "NG")).toEqual({ ok: true, e164: "+442079460958" });
  });
  it("rejects invalid numbers and junk", () => {
    expect(parsePhoneStrict("12345", "NG").ok).toBe(false);
    expect(parsePhoneStrict("0803<script>", "NG").ok).toBe(false);
    expect(parsePhoneStrict("", "NG").ok).toBe(false);
  });
});

describe("references", () => {
  it("are 8 upper-case characters from the id", () => {
    expect(requestReference("3f2a9c1d-0000-4000-8000-000000000000")).toBe("3F2A9C1D");
  });
});
