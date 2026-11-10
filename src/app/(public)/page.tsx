import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, Check } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { Rings, SectionHeading } from "@/components/public/page-hero";
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

      {/* Hero: the dashboard photo (or Russian Purple) behind the floating header; headline left,
          search card right; rounded lower edge with the category strip overlapping it. */}
      <section className="relative isolate -mt-[4.75rem] overflow-hidden rounded-b-[2.5rem] bg-brand md:-mt-[5.25rem] md:rounded-b-[3.5rem]">
        {heroImage ? (
          <>
            {/* Decorative background chosen in the dashboard. A flat purple tint keeps the white
                text readable on any photo while the image stays visible. */}
            <Image src={heroImage} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-deep/65" />
          </>
        ) : (
          <>
            <Rings className="-top-48 -right-40 -z-10 size-[44rem] text-brand-light/15" />
            <Rings className="-bottom-72 -left-56 -z-10 size-[36rem] text-brand-light/10" />
          </>
        )}
        <div className="container-content grid items-center gap-12 pt-32 pb-28 md:pt-44 md:pb-36 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <div className="flex flex-col gap-7" data-reveal>
            <p className="inline-flex items-center gap-2.5 self-start rounded-full border border-brand-light/40 bg-white/10 px-4 py-1.5 text-caption font-semibold tracking-[0.08em] text-white backdrop-blur-sm">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-light" />
              {siteConfig.name}
            </p>
            <h1 className="text-h1 leading-[1.03] text-white md:text-display">
              {hero.heading ?? "Find land and buildings for sale, rent and lease."}
            </h1>
            <p className="max-w-xl text-body-lg text-white/90">
              {hero.text ?? "Search by location, property type and price, and see full details for every listing."}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href="/properties"
                size="lg"
                variant="inverse"
                trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Browse properties
              </ButtonLink>
              <ButtonLink
                href="/contact"
                size="lg"
                variant="outline-light"
                leadingIcon={<CalendarDays className="size-4" aria-hidden="true" />}
              >
                Book an inspection
              </ButtonLink>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-small text-white/85">
              {["Land and buildings", "For sale, rent and lease", "Book inspections online"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-brand-light" strokeWidth={2.25} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="relative">
            <span
              aria-hidden="true"
              className="absolute -inset-3 -z-10 hidden rotate-2 rounded-[2rem] bg-brand-light/25 sm:block"
            />
            <PropertySearchForm />
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <PropertyCategories />
      </Suspense>
      <Suspense fallback={null}>
        <AboutPreview />
      </Suspense>

      <section className="container-content flex flex-col gap-12 pt-20 md:pt-28" aria-labelledby="featured-heading">
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
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          id="featured-heading"
          eyebrow="Our listings"
          title={title}
          text={text ?? "Handpicked listings, with full details and photos."}
        />
        {listings.length > 0 && (
          <ButtonLink
            href="/properties"
            variant="secondary"
            className="self-start md:self-auto"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            View all properties
          </ButtonLink>
        )}
      </div>
      {listings.length ? (
        <PropertyGrid listings={listings} priorityCount={1} columns={4} />
      ) : (
        <p className="rounded-[1.75rem] border border-dashed border-line-strong bg-brand-tint/60 p-10 text-center text-body text-stone">
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
