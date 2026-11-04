import type { PricePeriod } from "@/lib/format";

/**
 * Pricing display rules (agreed Stage 1):
 * - Main price = sales price if present, otherwise regular price.
 * - Struck-through regular price and discount appear only when the promotion is active
 *   and 0 < sales < regular.
 * - Discount is always calculated, never entered. The database computes the stored value
 *   with the same formula (Stage 3); this function mirrors it for previews and display.
 * - Nothing is invented: if no price was entered, nothing is shown.
 */
export interface PricingInput {
  regularPrice: number | null;
  salesPrice: number | null;
  instalmentPrice: number | null;
  instalmentNote: string | null;
  promotionActive: boolean;
  pricePeriod: PricePeriod | null;
}

export interface PriceDisplay {
  mainPrice: number | null;
  compareAtPrice: number | null;
  discountPercent: number | null;
  instalmentPrice: number | null;
  instalmentNote: string | null;
  pricePeriod: PricePeriod | null;
}

function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

export function calculateDiscountPercent(regular: number | null, sales: number | null): number | null {
  if (!isPositive(regular) || !isPositive(sales) || sales >= regular) return null;
  const percent = Math.round(((regular - sales) / regular) * 100);
  return percent > 0 ? percent : null;
}

export function resolvePriceDisplay(input: PricingInput): PriceDisplay {
  const regular = isPositive(input.regularPrice) ? input.regularPrice : null;
  const sales = isPositive(input.salesPrice) ? input.salesPrice : null;
  const mainPrice = sales ?? regular;

  const discountPercent = input.promotionActive ? calculateDiscountPercent(regular, sales) : null;

  const note = input.instalmentNote?.trim() ? input.instalmentNote.trim() : null;

  return {
    mainPrice,
    compareAtPrice: discountPercent !== null ? regular : null,
    discountPercent,
    instalmentPrice: isPositive(input.instalmentPrice) ? input.instalmentPrice : null,
    instalmentNote: note,
    pricePeriod: mainPrice !== null ? input.pricePeriod : null,
  };
}
