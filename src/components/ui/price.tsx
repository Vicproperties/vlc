import { cn } from "@/lib/cn";
import { formatNaira, formatPricePeriod } from "@/lib/format";
import { resolvePriceDisplay, type PricingInput } from "@/features/properties/pricing";

/**
 * Renders only the prices that exist. Returns null when no price was entered.
 */
export function Price({
  pricing,
  size = "md",
  showInstalment = false,
  className,
}: {
  pricing: PricingInput;
  size?: "sm" | "md" | "lg";
  showInstalment?: boolean;
  className?: string;
}) {
  const display = resolvePriceDisplay(pricing);
  if (display.mainPrice === null && !(showInstalment && display.instalmentPrice !== null)) return null;

  const mainSize = { sm: "text-h4", md: "text-h3", lg: "text-h2" }[size];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {display.mainPrice !== null && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("font-serif text-ink", mainSize)}>{formatNaira(display.mainPrice)}</span>
          {display.pricePeriod && (
            <span className="text-small text-stone">{formatPricePeriod(display.pricePeriod)}</span>
          )}
          {display.compareAtPrice !== null && (
            <span className="text-small text-stone line-through">
              <span className="sr-only">Regular price </span>
              {formatNaira(display.compareAtPrice)}
            </span>
          )}
        </p>
      )}
      {showInstalment && display.instalmentPrice !== null && (
        <p className="text-small text-ink">
          <span className="text-stone">Instalment: </span>
          {formatNaira(display.instalmentPrice)}
        </p>
      )}
      {showInstalment && display.instalmentNote && <p className="text-small text-stone">{display.instalmentNote}</p>}
    </div>
  );
}

/**
 * Discount label shown over a property image. A flat typographic strip with square corners,
 * rendered only when a valid active promotion exists.
 */
export function DiscountLabel({ percent, className }: { percent: number | null; className?: string }) {
  if (percent === null) return null;
  return (
    <span
      className={cn(
        "inline-block bg-brand px-3 py-1.5 font-sans text-caption font-semibold tracking-[0.14em] text-white uppercase",
        className,
      )}
    >
      {percent}% off
    </span>
  );
}
