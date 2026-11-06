import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { DiscountLabel, Price } from "@/components/ui/price";
import { FavouriteButton } from "./favourite-button";
import type { ListingCardData } from "@/features/listings/queries";
import { propertyImageUrl } from "@/features/properties/media";
import { LAND_USE_LABELS, PURPOSE_LABELS } from "@/features/properties/options";
import { formatLandSize } from "@/lib/format";

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

export function PropertyCard({ listing, priority = false }: { listing: ListingCardData; priority?: boolean }) {
  const unavailable = listing.status === "unavailable";
  const place = listingPlace(listing);

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {listing.cover_image_path ? (
          <Image
            src={propertyImageUrl(listing.cover_image_path)}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.02] ${unavailable ? "grayscale-[60%]" : ""}`}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-stone">
            <ImageOff className="size-6" strokeWidth={1.25} aria-hidden="true" />
          </div>
        )}
        {listing.id && (
          <div className="absolute top-2 right-2 z-10">
            <FavouriteButton propertyId={listing.id} title={listing.title ?? "this property"} />
          </div>
        )}
        <div className="absolute top-0 left-0 flex flex-col items-start">
          {unavailable ? (
            <span className="bg-ink px-3 py-1.5 text-caption font-semibold tracking-[0.14em] text-white uppercase">
              Unavailable
            </span>
          ) : (
            <DiscountLabel percent={listing.discount_percent} />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 pt-5">
        {listing.purpose && <p className="eyebrow">{PURPOSE_LABELS[listing.purpose]}</p>}
        <h3 className="font-serif text-h4 leading-snug text-ink">
          <Link
            href={`/properties/${listing.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {listing.title}
          </Link>
        </h3>
        {place && <p className="text-small text-stone">{place}</p>}
        <p className="text-small text-ink">{listingFacts(listing).join(" · ")}</p>
        <Price
          size="sm"
          className="mt-auto pt-2"
          pricing={{
            regularPrice: listing.regular_price,
            salesPrice: listing.sales_price,
            instalmentPrice: null,
            instalmentNote: null,
            promotionActive: listing.promotion_active ?? false,
            pricePeriod: listing.price_period,
          }}
        />
      </div>
      {/* Keyboard focus ring for the whole card (the link covers the card). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 hidden outline-2 outline-offset-0 outline-brand group-has-[a:focus-visible]:block"
      />
    </article>
  );
}

export function PropertyGrid({ listings, priorityCount = 0 }: { listings: ListingCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing, index) => (
        <li key={listing.id}>
          <PropertyCard listing={listing} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
