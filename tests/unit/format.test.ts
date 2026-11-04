import { describe, expect, it } from "vitest";
import { formatLandSize, formatNaira, formatPricePeriod } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { pageWindow } from "@/components/ui/pagination";

describe("formatNaira", () => {
  it("formats whole naira with the ₦ symbol and grouping", () => {
    expect(formatNaira(25_000_000)).toBe("₦25,000,000");
    expect(formatNaira(0)).toBe("₦0");
    expect(formatNaira(1499.6)).toBe("₦1,500");
  });
});

describe("formatLandSize", () => {
  it("combines the value and selected unit", () => {
    expect(formatLandSize(500, "sqm")).toBe("500 sqm");
    expect(formatLandSize(1, "plot")).toBe("1 plot");
    expect(formatLandSize(2, "plot")).toBe("2 plots");
    expect(formatLandSize(1.5, "hectare")).toBe("1.5 hectares");
    expect(formatLandSize(1200, "acre")).toBe("1,200 acres");
  });
});

describe("formatPricePeriod", () => {
  it("labels periods", () => {
    expect(formatPricePeriod("per_month")).toBe("per month");
  });
});

describe("slugify", () => {
  it("creates URL-friendly slugs", () => {
    expect(slugify("  Plots in Lekki Phase 1 — Ajah  ")).toBe("plots-in-lekki-phase-1-ajah");
    expect(slugify("Sale & Lease")).toBe("sale-and-lease");
    expect(slugify("Café Éstate")).toBe("cafe-estate");
    expect(slugify("<script>alert(1)</script>")).toBe("script-alert-1-script");
  });

  it("truncates at a word boundary", () => {
    const slug = slugify("a".repeat(10) + " " + "b".repeat(10), 15);
    expect(slug).toBe("aaaaaaaaaa");
  });
});

describe("pageWindow", () => {
  it("lists all pages when there are few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("inserts gaps for long ranges", () => {
    expect(pageWindow(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, "gap", 12]);
  });
});
