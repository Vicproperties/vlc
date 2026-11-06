import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { PropertyGrid } from "@/components/public/property-card";
import {
  AboutPreview,
  ContactSection,
  LatestNews,
  PropertyCategories,
  WhyChooseUs,
} from "@/components/public/home-sections";
import { PropertySearchForm } from "@/components/public/property-search-form";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { siteConfig } from "@/config/site";
import { homeSectionHeadingSchema, readSection } from "@/features/content/home-sections";
import { findSection, readContent } from "@/features/content/sections";
import { cn } from "@/lib/cn";
import { publicStorageUrl } from "@/lib/images";
import { getFeaturedListings, getHomeSections, getLatestListings } from "@/features/listings/queries";
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

      {/* Hero: full-width photo behind the floating header, headline left, search card right. */}
      <section
        className={cn(
          "relative isolate -mt-[4.75rem] overflow-hidden md:-mt-[5.25rem]",
          heroImage ? "bg-ink" : "bg-brand-tint",
        )}
      >
        {heroImage && (
          <>
            {/* Decorative background chosen in the dashboard. A flat ink tint (no gradient)
                keeps the white text readable on typical photos while the image stays visible. */}
            <Image src={heroImage} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/50" />
          </>
        )}
        <div className="container-content grid items-center gap-10 pt-32 pb-24 md:pt-40 md:pb-32 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="flex flex-col gap-6">
            <p
              className={cn(
                "self-start rounded-full px-4 py-1.5 text-caption font-semibold",
                heroImage ? "bg-white/15 text-white backdrop-blur-sm" : "bg-white text-brand",
              )}
            >
              {siteConfig.name}
            </p>
            <h1 className={cn("text-h1 leading-[1.05] md:text-display", heroImage ? "text-white" : "text-ink")}>
              {hero.heading ?? "Find land and buildings for sale, rent and lease."}
            </h1>
            <p className={cn("max-w-xl text-body-lg", heroImage ? "text-white/90" : "text-stone")}>
              {hero.text ?? "Search by location, property type and price, and see full details for every listing."}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href="/properties"
                size="lg"
                trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Browse properties
              </ButtonLink>
              <ButtonLink
                href="/contact"
                size="lg"
                variant="secondary"
                leadingIcon={<CalendarDays className="size-4" aria-hidden="true" />}
              >
                Book an inspection
              </ButtonLink>
            </div>
          </div>
          <PropertySearchForm />
        </div>
      </section>

      <Suspense fallback={null}>
        <PropertyCategories />
      </Suspense>
      <Suspense fallback={null}>
        <AboutPreview />
      </Suspense>

      <section className="container-content flex flex-col gap-10 py-16 md:py-20" aria-labelledby="featured-heading">
        <Suspense fallback={<GridSkeleton />}>
          <FeaturedListings heading={featured?.heading} text={featured?.text} />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <WhyChooseUs heading={why?.heading} text={why?.text} />
      </Suspense>
      <Suspense fallback={null}>
        <LatestNews />
      </Suspense>
      <Suspense fallback={null}>
        <ContactSection />
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
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <h2 id="featured-heading" className="text-h2">
          {title}
        </h2>
        <p className="text-body text-stone">{text ?? "Handpicked listings, with full details and photos."}</p>
      </div>
      {listings.length ? (
        <>
          <PropertyGrid listings={listings} priorityCount={1} columns={4} />
          <div className="flex justify-center">
            <ButtonLink
              href="/properties"
              variant="secondary"
              trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              View all properties
            </ButtonLink>
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-8 text-center text-body text-stone">
          New listings will appear here soon.
        </p>
      )}
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="aspect-[4/3] rounded-2xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
