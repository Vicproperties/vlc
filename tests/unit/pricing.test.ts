import { describe, expect, it } from "vitest";
import { calculateDiscountPercent, resolvePriceDisplay, type PricingInput } from "@/features/properties/pricing";

const base: PricingInput = {
  regularPrice: null,
  salesPrice: null,
  instalmentPrice: null,
  instalmentNote: null,
  promotionActive: false,
  pricePeriod: null,
};

describe("calculateDiscountPercent", () => {
  it("calculates a rounded percentage", () => {
    expect(calculateDiscountPercent(30_000_000, 25_500_000)).toBe(15);
    expect(calculateDiscountPercent(3, 2)).toBe(33);
  });

  it("returns null for invalid or missing prices", () => {
    expect(calculateDiscountPercent(null, 100)).toBeNull();
    expect(calculateDiscountPercent(100, null)).toBeNull();
    expect(calculateDiscountPercent(100, 100)).toBeNull();
    expect(calculateDiscountPercent(100, 150)).toBeNull();
    expect(calculateDiscountPercent(0, 0)).toBeNull();
    expect(calculateDiscountPercent(100, -5)).toBeNull();
    expect(calculateDiscountPercent(Number.NaN, 5)).toBeNull();
  });

  it("returns null when the discount rounds to zero", () => {
    expect(calculateDiscountPercent(1_000_000, 999_999)).toBeNull();
  });
});

describe("resolvePriceDisplay", () => {
  it("shows nothing when no price was entered", () => {
    const d = resolvePriceDisplay(base);
    expect(d.mainPrice).toBeNull();
    expect(d.discountPercent).toBeNull();
    expect(d.compareAtPrice).toBeNull();
  });

  it("uses the regular price when no sales price exists", () => {
    expect(resolvePriceDisplay({ ...base, regularPrice: 5_000_000 }).mainPrice).toBe(5_000_000);
  });

  it("uses the sales price as main price even when the promotion is inactive, without strike-through", () => {
    const d = resolvePriceDisplay({ ...base, regularPrice: 10_000_000, salesPrice: 8_000_000 });
    expect(d.mainPrice).toBe(8_000_000);
    expect(d.compareAtPrice).toBeNull();
    expect(d.discountPercent).toBeNull();
  });

  it("shows strike-through and discount only for an active, valid promotion", () => {
    const d = resolvePriceDisplay({ ...base, regularPrice: 10_000_000, salesPrice: 8_000_000, promotionActive: true });
    expect(d.mainPrice).toBe(8_000_000);
    expect(d.compareAtPrice).toBe(10_000_000);
    expect(d.discountPercent).toBe(20);
  });

  it("hides the discount when the active promotion has invalid prices", () => {
    const d = resolvePriceDisplay({ ...base, regularPrice: 8_000_000, salesPrice: 9_000_000, promotionActive: true });
    expect(d.discountPercent).toBeNull();
    expect(d.compareAtPrice).toBeNull();
  });

  it("drops blank instalment notes and keeps the price period only with a price", () => {
    expect(resolvePriceDisplay({ ...base, instalmentNote: "   " }).instalmentNote).toBeNull();
    expect(resolvePriceDisplay({ ...base, pricePeriod: "per_year" }).pricePeriod).toBeNull();
    expect(resolvePriceDisplay({ ...base, regularPrice: 1, pricePeriod: "per_year" }).pricePeriod).toBe("per_year");
  });
});
