import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, X } from "lucide-react";
import { ListingFilterForm } from "@/components/public/listing-filters";
import { MobileFilters, SortMenu } from "@/components/public/listing-controls";
import { PropertyGrid } from "@/components/public/property-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, Skeleton } from "@/components/ui/states";
import {
  activeFilters,
  hasActiveFilters,
  listingsHref,
  parseListingFilters,
  SORT_LABELS,
  SORTS,
} from "@/features/listings/filters";
import { getPublicBuildingTypes, LISTINGS_PAGE_SIZE, searchListings } from "@/features/listings/queries";
import { PageHero } from "@/components/public/page-hero";

const TITLE = "Properties for sale, rent and lease";

export async function generateMetadata({ searchParams }: PageProps<"/properties">): Promise<Metadata> {
  const filters = parseListingFilters(await searchParams);
  const filtered = hasActiveFilters(filters) || filters.sort !== "newest";
  return {
    title: TITLE,
    description: "Browse land and buildings. Filter by state, type, purpose and price.",
    // Filter combinations are not indexed (endless near-duplicate pages); pages of the
    // unfiltered list are.
    alternates: { canonical: filtered ? "/properties" : listingsHref(filters, { page: filters.page }) },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="Our listings"
        title="Properties"
        text="Land and buildings for sale, rent and lease. Filter by location, type and price."
      />
      <div className="container-content flex flex-col gap-10 py-12 md:py-16">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/properties">["searchParams"] }) {
  const filters = parseListingFilters(await searchParams);
  const [{ rows, total }, buildingTypes] = await Promise.all([searchListings(filters), getPublicBuildingTypes()]);
  const totalPages = Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE));
  const active = activeFilters(filters, new Map(buildingTypes.map((t) => [t.slug, t.name])));

  return (
    <div className="grid gap-10 lg:grid-cols-[17rem_1fr] lg:gap-14">
      <aside className="hidden lg:block" aria-label="Filters">
        <ListingFilterForm filters={filters} buildingTypes={buildingTypes} idPrefix="side" />
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <p className="text-small text-ink" aria-live="polite">
            {total === 0 ? "No properties found" : `${total} ${total === 1 ? "property" : "properties"}`}
            {totalPages > 1 && (
              <span className="text-stone">
                {" "}
                · page {Math.min(filters.page, totalPages)} of {totalPages}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <MobileFilters activeCount={active.length}>
              <ListingFilterForm filters={filters} buildingTypes={buildingTypes} idPrefix="drawer" />
            </MobileFilters>
            <SortMenu
              value={filters.sort}
              options={SORTS.map((sort) => ({
                value: sort,
                label: SORT_LABELS[sort],
                href: listingsHref(filters, { sort }),
              }))}
            />
          </div>
        </div>

        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Active filters">
            {active.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="inline-flex items-center gap-1.5 border-b border-line-strong pb-0.5 text-small text-ink hover:border-ink"
              >
                {item.label}
                <X className="size-3.5 text-stone" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">(remove filter)</span>
              </Link>
            ))}
            <Link href="/properties" className="text-small text-brand underline underline-offset-4">
              Clear all
            </Link>
          </div>
        )}

        {rows.length ? (
          <PropertyGrid listings={rows} priorityCount={1} />
        ) : (
          <EmptyState
            icon={Building2}
            title={active.length ? "No properties match these filters" : "No properties listed yet"}
            description={
              active.length ? "Try removing a filter or searching for a nearby area." : "Please check back soon."
            }
            action={
              active.length ? (
                <Link href="/properties" className="text-small text-brand underline underline-offset-4">
                  Clear all filters
                </Link>
              ) : undefined
            }
          />
        )}

        <Pagination
          page={Math.min(filters.page, totalPages)}
          totalPages={totalPages}
          hrefFor={(page) => listingsHref(filters, { page })}
          className="pt-4"
        />
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[17rem_1fr] lg:gap-14" aria-hidden="true">
      <Skeleton className="hidden h-[32rem] lg:block" />
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4">
            <Skeleton className="aspect-[4/3]" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
