import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { PropertyGrid } from "@/components/public/property-card";
import { PropertySearchForm } from "@/components/public/property-search-form";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { siteConfig } from "@/config/site";
import { homeSectionHeadingSchema, readSection } from "@/features/content/home-sections";
import { findSection, readContent } from "@/features/content/sections";
import { cn } from "@/lib/cn";
import { publicStorageUrl } from "@/lib/images";
import {
  getFeaturedListings,
  getHomeSections,
  getLatestListings,
  getWhyChooseUsItems,
} from "@/features/listings/queries";
import { publicEnv } from "@/lib/env/client";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Homepage. Section text comes from the dashboard (page_sections, Stage 8); until it is
 * written, neutral defaults are shown. Sections without content are left out entirely.
 */
export default async function HomePage() {
  const sections = await getHomeSections();
  const heroDef = findSection("home", "hero");
  const hero = heroDef ? readContent(heroDef, sections.get("hero")) : {};
  const heroImage = hero.image_path ? publicStorageUrl("site-media", hero.image_path) : null;
  const featured = readSection(homeSectionHeadingSchema, sections.get("featured"));
  const why = readSection(homeSectionHeadingSchema, sections.get("why_choose_us"));
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteConfig.name,
          url: siteUrl,
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/properties?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        }}
      />

      <section className={cn("relative isolate border-b border-line", heroImage ? "bg-ink" : "bg-surface")}>
        {heroImage && (
          <>
            {/* Decorative background chosen in the dashboard. A flat 55% ink tint (no gradient)
                keeps the white text readable on typical photos while the image stays visible. */}
            <Image src={heroImage} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/55" />
          </>
        )}
        <div className={cn("container-content flex flex-col gap-10 py-16 md:py-24", heroImage && "md:py-32")}>
          <div className="flex max-w-3xl flex-col gap-5">
            <p className={cn("eyebrow", heroImage && "text-white/85")}>{siteConfig.name}</p>
            <h1 className={cn("text-h1 md:text-display", heroImage && "text-white")}>
              {hero.heading ?? "Find land and buildings for sale, rent and lease."}
            </h1>
            <p className={cn("max-w-2xl text-h4 font-normal", heroImage ? "text-white/90" : "text-stone")}>
              {hero.text ?? "Search by location, property type and price, and see full details for every listing."}
            </p>
          </div>
          <PropertySearchForm />
        </div>
      </section>

      <section className="container-content flex flex-col gap-10 py-16 md:py-24" aria-labelledby="featured-heading">
        <Suspense fallback={<GridSkeleton />}>
          <FeaturedListings heading={featured?.heading} text={featured?.text} />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <WhyChooseUs heading={why?.heading} text={why?.text} />
      </Suspense>
    </>
  );
}

async function FeaturedListings({ heading, text }: { heading?: string; text?: string }) {
  const featured = await getFeaturedListings();
  const listings = featured.length ? featured : await getLatestListings();
  const title = heading ?? (featured.length ? "Featured properties" : "Latest properties");

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="featured-heading" className="text-h1">
            {title}
          </h2>
          {text && <p className="text-body text-stone">{text}</p>}
        </div>
        {listings.length > 0 && (
          <ButtonLink
            href="/properties"
            variant="link"
            trailingIcon={<ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />}
          >
            View all properties
          </ButtonLink>
        )}
      </div>
      {listings.length ? (
        <PropertyGrid listings={listings} priorityCount={1} />
      ) : (
        <p className="border-t border-line pt-8 text-body text-stone">New listings will appear here soon.</p>
      )}
    </>
  );
}

async function WhyChooseUs({ heading, text }: { heading?: string; text?: string }) {
  const items = await getWhyChooseUsItems();
  if (!items.length) return null;
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="why-heading">
      <div className="container-content flex flex-col gap-12 py-16 md:py-24">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="why-heading" className="text-h1">
            {heading ?? "Why choose us"}
          </h2>
          {text && <p className="text-body text-stone">{text}</p>}
        </div>
        <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 border-t border-brand-light pt-6">
              <h3 className="font-serif text-h4 text-ink">{item.title}</h3>
              {item.description && <p className="text-small text-stone">{item.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="aspect-[4/3]" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
