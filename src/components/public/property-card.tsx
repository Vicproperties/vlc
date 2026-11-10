import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, ImageOff, LandPlot, MapPin, Ruler } from "lucide-react";
import { DiscountLabel } from "@/components/ui/price";
import { FavouriteButton } from "./favourite-button";
import type { ListingCardData } from "@/features/listings/queries";
import { resolvePriceDisplay } from "@/features/properties/pricing";
import { propertyImageUrl } from "@/features/properties/media";
import { LAND_USE_LABELS, PURPOSE_LABELS } from "@/features/properties/options";
import { cn } from "@/lib/cn";
import { formatLandSize, formatNaira, formatPricePeriod } from "@/lib/format";

/** Short, factual summary line. Only facts that were entered are shown. */
export function listingFacts(
  listing: Pick<
    ListingCardData,
    "kind" | "land_use" | "land_size" | "land_size_unit" | "building_type" | "bedrooms" | "bathrooms"
  >,
): string[] {
  const facts: string[] = [];
  if (listing.kind === "land") {
    if (listing.land_use) facts.push(`${LAND_USE_LABELS[listing.land_use]} land`);
    else facts.push("Land");
  } else {
    facts.push(listing.building_type ?? "Building");
    if (listing.bedrooms) facts.push(`${listing.bedrooms} bed`);
    if (listing.bathrooms) facts.push(`${listing.bathrooms} bath`);
  }
  if (listing.land_size && listing.land_size_unit)
    facts.push(formatLandSize(listing.land_size, listing.land_size_unit));
  return facts;
}

export function listingPlace(listing: Pick<ListingCardData, "city" | "state" | "location_text">): string | null {
  return [listing.city, listing.state].filter(Boolean).join(", ") || listing.location_text || null;
}

/** Icon facts for the card footer: only what was entered. */
function CardFacts({ listing }: { listing: ListingCardData }) {
  const items: Array<{ icon: typeof BedDouble; label: string; sr: string }> = [];
  if (listing.kind === "land") {
    items.push({
      icon: LandPlot,
      label: listing.land_use ? LAND_USE_LABELS[listing.land_use] : "Land",
      sr: "Land use",
    });
  } else {
    if (listing.bedrooms) items.push({ icon: BedDouble, label: String(listing.bedrooms), sr: "Bedrooms" });
    if (listing.bathrooms) items.push({ icon: Bath, label: String(listing.bathrooms), sr: "Bathrooms" });
    if (!listing.bedrooms && !listing.bathrooms && listing.building_type)
      items.push({ icon: LandPlot, label: listing.building_type, sr: "Building type" });
  }
  if (listing.land_size && listing.land_size_unit)
    items.push({ icon: Ruler, label: formatLandSize(listing.land_size, listing.land_size_unit), sr: "Size" });
  if (!items.length) return null;
  return (
    <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5 text-small text-stone">
      {items.map((item) => (
        <li key={item.sr} className="flex items-center gap-1.5">
          <item.icon className="size-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{item.sr}: </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function PropertyCard({ listing, priority = false }: { listing: ListingCardData; priority?: boolean }) {
  const unavailable = listing.status === "unavailable";
  const place = listingPlace(listing);
  const price = resolvePriceDisplay({
    regularPrice: listing.regular_price,
    salesPrice: listing.sales_price,
    instalmentPrice: null,
    instalmentNote: null,
    promotionActive: listing.promotion_active ?? false,
    pricePeriod: listing.price_period,
  });

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-line/70 bg-white shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {listing.cover_image_path ? (
          <Image
            src={propertyImageUrl(listing.cover_image_path)}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-[1.04]",
              unavailable && "grayscale-[60%]",
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-stone">
            <ImageOff className="size-6" strokeWidth={1.25} aria-hidden="true" />
          </div>
        )}
        {listing.id && (
          <div className="absolute top-3 right-3 z-10">
            <FavouriteButton propertyId={listing.id} title={listing.title ?? "this property"} />
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
          {unavailable ? (
            <span className="rounded-full bg-ink px-3 py-1 text-caption font-semibold text-white">Unavailable</span>
          ) : (
            <DiscountLabel percent={listing.discount_percent} />
          )}
        </div>
        {price.mainPrice !== null && (
          <p className="absolute bottom-3 left-3 flex items-baseline gap-2 rounded-xl bg-white/95 px-3 py-1.5 shadow-card backdrop-blur-sm">
            <span className="text-body font-bold tracking-[-0.02em] text-ink">{formatNaira(price.mainPrice)}</span>
            {price.pricePeriod && (
              <span className="text-caption text-stone">{formatPricePeriod(price.pricePeriod)}</span>
            )}
            {price.compareAtPrice !== null && (
              <span className="text-caption text-stone line-through">
                <span className="sr-only">Regular price </span>
                {formatNaira(price.compareAtPrice)}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        {listing.purpose && (
          <p className="self-start rounded-full bg-brand-tint px-3 py-1 text-caption font-semibold tracking-[0.06em] text-brand uppercase">
            {PURPOSE_LABELS[listing.purpose]}
          </p>
        )}
        <h3 className="text-h4 leading-snug text-ink">
          <Link
            href={`/properties/${listing.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {listing.title}
          </Link>
        </h3>
        {place && (
          <p className="flex items-center gap-1.5 text-small text-stone">
            <MapPin className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {place}
          </p>
        )}
        <div className="pt-1.5">
          <CardFacts listing={listing} />
        </div>
      </div>
      {/* Keyboard focus ring for the whole card (the link covers the card). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden rounded-[1.5rem] outline-2 -outline-offset-2 outline-brand group-has-[a:focus-visible]:block"
      />
    </article>
  );
}

export function PropertyGrid({
  listings,
  priorityCount = 0,
  columns = 3,
}: {
  listings: ListingCardData[];
  priorityCount?: number;
  columns?: 3 | 4;
}) {
  return (
    <ul
      data-reveal-stagger
      className={cn("grid gap-6 sm:grid-cols-2", columns === 4 ? "lg:grid-cols-3 xl:grid-cols-4" : "xl:grid-cols-3")}
    >
      {listings.map((listing, index) => (
        <li key={listing.id}>
          <PropertyCard listing={listing} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
