import { describe, expect, it } from "vitest";
import { parsePhone } from "@/lib/phone";

describe("parsePhone", () => {
  it("accepts Nigerian local and international formats", () => {
    for (const input of ["0803 123 4567", "08031234567", "+234 803 123 4567", "+2348031234567"]) {
      const result = parsePhone(input);
      expect(result.ok, input).toBe(true);
      if (result.ok) expect(result.e164).toBe("+2348031234567");
    }
  });

  it("accepts international numbers", () => {
    const uk = parsePhone("+44 20 7946 0958");
    expect(uk.ok).toBe(true);
    if (uk.ok) expect(uk.country).toBe("GB");

    const us = parsePhone("(415) 555-2671", "US");
    expect(us.ok).toBe(true);
    if (us.ok) expect(us.e164).toBe("+14155552671");
  });

  it("rejects empty, malformed and invalid numbers", () => {
    expect(parsePhone("").ok).toBe(false);
    expect(parsePhone("abc").ok).toBe(false);
    expect(parsePhone("0803").ok).toBe(false);
    expect(parsePhone("<script>").ok).toBe(false);
  });
});
