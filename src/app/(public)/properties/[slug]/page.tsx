import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MapPin, MessageCircle, Check } from "lucide-react";
import { FavouriteButton } from "@/components/public/favourite-button";
import { InspectionForm } from "@/components/public/inspection-form";
import { JsonLd } from "@/components/public/json-ld";
import { listingPlace } from "@/components/public/property-card";
import { PropertyGallery } from "@/components/public/property-gallery";
import { ShareButtons } from "@/components/public/share-buttons";
import { YouTubeEmbed } from "@/components/public/youtube-embed";
import { DiscountLabel, Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/states";
import {
  getListingBySlug,
  getListingSitemapEntries,
  getPublicSiteSettings,
  type ListingDetail,
} from "@/features/listings/queries";
import { propertyImageUrl } from "@/features/properties/media";
import { LAND_USE_LABELS, PURPOSE_LABELS } from "@/features/properties/options";
import { publicEnv } from "@/lib/env/client";
import { formatDate, formatLandSize, formatNumber } from "@/lib/format";
import { sanitizeRichText } from "@/lib/rich-text";

export async function generateMetadata({ params }: PageProps<"/properties/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Property not found", robots: { index: false } };

  const description = (listing.seo_description ?? listing.description ?? "").replace(/\s+/g, " ").slice(0, 160);
  const image = listing.og_image_path ?? listing.cover_image_path;
  return {
    title: listing.seo_title ?? listing.title,
    description: description || undefined,
    alternates: { canonical: `/properties/${listing.slug}` },
    openGraph: {
      type: "website",
      title: listing.seo_title ?? listing.title ?? undefined,
      description: description || undefined,
      url: `/properties/${listing.slug}`,
      images: image ? [{ url: propertyImageUrl(image) }] : undefined,
    },
  };
}

/**
 * Pre-renders recently listed properties at build time; others render on first visit and are
 * then cached (tag "listings"). Cache Components requires at least one entry, so a
 * placeholder that can never match a slug is used while no listings exist.
 */
export async function generateStaticParams() {
  const entries = await getListingSitemapEntries();
  const slugs = entries.flatMap((entry) => (entry.slug ? [{ slug: entry.slug }] : [])).slice(0, 100);
  return slugs.length ? slugs : [{ slug: "__no-listings__" }];
}

/**
 * The address is read inside Suspense, so the page frame (header, footer) never depends on it
 * and Next.js can always rebuild the route in the background after a listing changes. Reading
 * it outside made those rebuilds fail ("blocking prerender") and could leave visitors on an
 * outdated page. Prebuilt listings still render in full at build time; missing, draft or
 * archived properties render the not-found content with noindex (ADR-003).
 */
export default function PropertyPage({ params }: PageProps<"/properties/[slug]">) {
  return (
    <Suspense fallback={<PropertySkeleton />}>
      <PropertyContent params={params} />
    </Suspense>
  );
}

function PropertySkeleton() {
  return (
    <div className="container-content flex flex-col gap-6 py-12" aria-busy="true">
      <p className="sr-only">Loading property</p>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="aspect-[16/9] w-full" />
      <Skeleton className="h-40" />
    </div>
  );
}

async function PropertyContent({ params }: { params: PageProps<"/properties/[slug]">["params"] }) {
  const { slug } = await params;
  const [listing, settings] = await Promise.all([getListingBySlug(slug), getPublicSiteSettings()]);
  if (!listing || !listing.id || !listing.title || !listing.slug) notFound();
  return (
    <PropertyDetail
      listing={{ ...listing, id: listing.id, title: listing.title, slug: listing.slug }}
      settings={settings}
    />
  );
}

function facts(listing: ListingDetail): Array<[string, string]> {
  const rows: Array<[string, string | null]> = [
    ["Type", listing.kind === "land" ? "Land" : (listing.building_type ?? "Building")],
    ["Purpose", listing.purpose ? PURPOSE_LABELS[listing.purpose] : null],
    ["Land use", listing.land_use ? LAND_USE_LABELS[listing.land_use] : null],
    [
      "Size",
      listing.land_size && listing.land_size_unit ? formatLandSize(listing.land_size, listing.land_size_unit) : null,
    ],
    ["Dimensions", listing.dimensions],
    ["Available plots", listing.available_plots !== null ? formatNumber(listing.available_plots) : null],
    ["Bedrooms", listing.bedrooms !== null ? String(listing.bedrooms) : null],
    ["Bathrooms", listing.bathrooms !== null ? String(listing.bathrooms) : null],
    ["Toilets", listing.toilets !== null ? String(listing.toilets) : null],
    ["Parking spaces", listing.parking_spaces !== null ? String(listing.parking_spaces) : null],
    ["Title documentation", listing.title_documentation],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

function PropertyDetail({
  listing,
  settings,
}: {
  listing: ListingDetail & { id: string; title: string; slug: string };
  settings: Awaited<ReturnType<typeof getPublicSiteSettings>>;
}) {
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  const url = `${siteUrl}/properties/${listing.slug}`;
  const unavailable = listing.status === "unavailable";
  const place = listingPlace(listing);
  // Stored HTML is sanitised on save; it is sanitised again here so rows written by any
  // other path (imports, maintenance) can never inject markup.
  const descriptionHtml = listing.description_html ? sanitizeRichText(listing.description_html) : "";
  const images = listing.images
    .filter((image) => image.storage_path)
    .map((image) => ({
      url: propertyImageUrl(image.storage_path!),
      alt: image.alt_text ?? "",
      width: image.width,
      height: image.height,
    }));
  const whatsapp = settings?.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hello, I am interested in “${listing.title}”: ${url}`,
      )}`
    : null;

  return (
    <article className="container-content flex flex-col gap-10 py-10 md:py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          name: listing.title,
          url,
          description: listing.description?.slice(0, 500) || undefined,
          datePosted: listing.published_at ?? undefined,
          image: images.slice(0, 5).map((image) => image.url),
          offers: listing.effective_price
            ? {
                "@type": "Offer",
                price: listing.effective_price,
                priceCurrency: "NGN",
                availability: unavailable ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
              }
            : undefined,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Properties", item: `${siteUrl}/properties` },
            { "@type": "ListItem", position: 3, name: listing.title, item: url },
          ],
        }}
      />

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-small text-stone">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/properties" className="hover:text-ink hover:underline">
              Properties
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate text-ink">
            {listing.title}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {listing.purpose && (
            <p className="rounded-full bg-brand-tint px-3.5 py-1.5 text-caption font-semibold tracking-[0.08em] text-brand uppercase">
              {PURPOSE_LABELS[listing.purpose]}
            </p>
          )}
          {unavailable ? (
            <span className="rounded-full bg-ink px-3.5 py-1.5 text-caption font-semibold tracking-[0.08em] text-white uppercase">
              Unavailable
            </span>
          ) : (
            <DiscountLabel percent={listing.discount_percent} />
          )}
        </div>
        <h1 className="max-w-4xl text-h1">{listing.title}</h1>
        {place && (
          <p className="flex items-center gap-2 text-body text-stone">
            <MapPin className="size-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
            {place}
          </p>
        )}
      </header>

      {unavailable && (
        <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-small text-ink">
          This property is currently unavailable. It is shown for reference.
        </p>
      )}

      {images.length > 0 && (
        <div>
          <PropertyGallery images={images} title={listing.title} />
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-12">
          {facts(listing).length > 0 && (
            <section
              aria-labelledby="facts-heading"
              className="flex flex-col gap-5 rounded-[1.75rem] border border-line bg-white p-6 shadow-card sm:p-8"
            >
              <h2 id="facts-heading" className="text-h3">
                Key details
              </h2>
              <dl className="grid gap-x-10 sm:grid-cols-2">
                {facts(listing).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-6 border-b border-line py-3">
                    <dt className="text-small text-stone">{label}</dt>
                    <dd className="text-right text-small font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {descriptionHtml && (
            <section aria-labelledby="description-heading" className="flex flex-col gap-5">
              <h2 id="description-heading" className="text-h3">
                Description
              </h2>
              <div
                className="rich-text max-w-3xl text-body text-ink"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </section>
          )}

          {listing.features && listing.features.length > 0 && (
            <section
              aria-labelledby="features-heading"
              className="flex flex-col gap-5 rounded-[1.75rem] bg-brand-tint/70 p-6 sm:p-8"
            >
              <h2 id="features-heading" className="text-h3">
                Features
              </h2>
              <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                {listing.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-small text-ink">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {listing.youtube_video_id && (
            <section aria-labelledby="video-heading" className="flex flex-col gap-5">
              <h2 id="video-heading" className="text-h3">
                Video
              </h2>
              <YouTubeEmbed videoId={listing.youtube_video_id} title={listing.title} />
            </section>
          )}

          {(listing.location_text || listing.address || listing.google_maps_url) && (
            <section aria-labelledby="location-heading" className="flex flex-col gap-4">
              <h2 id="location-heading" className="text-h3">
                Location
              </h2>
              {listing.location_text && <p className="text-body text-ink">{listing.location_text}</p>}
              {listing.address && <p className="text-small text-stone">{listing.address}</p>}
              {listing.google_maps_url && (
                <a
                  href={listing.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 self-start text-small text-brand underline underline-offset-4 hover:text-brand-deep"
                >
                  <MapPin className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Open in Google Maps
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-5 rounded-3xl border border-line/70 bg-white p-6 shadow-card">
            <Price
              size="lg"
              showInstalment
              pricing={{
                regularPrice: listing.regular_price,
                salesPrice: listing.sales_price,
                instalmentPrice: listing.instalment_price,
                instalmentNote: listing.instalment_note,
                promotionActive: listing.promotion_active ?? false,
                pricePeriod: listing.price_period,
              }}
            />
            {whatsapp && !unavailable && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-small font-medium tracking-[0.02em] text-white transition-colors hover:bg-brand-deep"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Enquire on WhatsApp
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
          {unavailable ? (
            <p className="text-small text-stone">Inspection requests are closed while this property is unavailable.</p>
          ) : (
            <div className="rounded-3xl border border-line/70 bg-white p-6 shadow-card">
              <InspectionForm propertyId={listing.id} />
            </div>
          )}
          <div className="flex flex-col gap-3">
            <FavouriteButton propertyId={listing.id} title={listing.title} variant="inline" />
            <h2 className="pt-3 text-small font-medium text-ink">Share this property</h2>
            <ShareButtons url={url} title={listing.title} />
          </div>
          {listing.published_at && <p className="text-caption text-stone">Listed {formatDate(listing.published_at)}</p>}
        </aside>
      </div>
    </article>
  );
}
