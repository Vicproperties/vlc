import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ListingFilters } from "@/features/listings/filters";
import { LAND_USE_LABELS, LAND_USES, NIGERIAN_STATES, PURPOSE_LABELS, PURPOSES } from "@/features/properties/options";

/**
 * Property filters as a plain GET form: every filter is a URL parameter, so results can be
 * shared, bookmarked and crawled, and the form works without JavaScript. `idPrefix` keeps
 * ids unique when the form is rendered twice (sidebar + mobile drawer).
 */
export function ListingFilterForm({
  filters,
  buildingTypes,
  idPrefix,
}: {
  filters: ListingFilters;
  buildingTypes: Array<{ name: string; slug: string }>;
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const field = (name: string, label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id(name)} className="text-small font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <form action="/properties" method="get" className="flex flex-col gap-5" aria-label="Filter properties">
      {field(
        "q",
        "Location or keyword",
        <>
          <Input id={id("q")} name="q" type="search" defaultValue={filters.q} maxLength={100} />
        </>,
      )}
      {field(
        "kind",
        "Property type",
        <>
          <Select
            id={id("kind")}
            name="kind"
            defaultValue={filters.kind ?? ""}
            placeholder="Land and buildings"
            options={[
              { value: "land", label: "Land" },
              { value: "building", label: "Buildings" },
            ]}
          />
        </>,
      )}
      {field(
        "purpose",
        "Purpose",
        <>
          <Select
            id={id("purpose")}
            name="purpose"
            defaultValue={filters.purpose ?? ""}
            placeholder="Any"
            options={PURPOSES.map((value) => ({ value, label: PURPOSE_LABELS[value] }))}
          />
        </>,
      )}
      {field(
        "state",
        "State",
        <>
          <Select
            id={id("state")}
            name="state"
            defaultValue={filters.state ?? ""}
            placeholder="All states"
            options={NIGERIAN_STATES.map((value) => ({ value, label: value }))}
          />
        </>,
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-medium text-ink">Price (₦)</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={id("min_price")} className="sr-only">
              Minimum price in naira
            </label>
            <Input
              id={id("min_price")}
              name="min_price"
              inputMode="numeric"
              placeholder="Min"
              defaultValue={filters.minPrice ?? ""}
            />
          </div>
          <div>
            <label htmlFor={id("max_price")} className="sr-only">
              Maximum price in naira
            </label>
            <Input
              id={id("max_price")}
              name="max_price"
              inputMode="numeric"
              placeholder="Max"
              defaultValue={filters.maxPrice ?? ""}
            />
          </div>
        </div>
      </fieldset>
      {field(
        "land_use",
        "Land use (land)",
        <>
          <Select
            id={id("land_use")}
            name="land_use"
            defaultValue={filters.landUse ?? ""}
            placeholder="Any"
            options={LAND_USES.map((value) => ({ value, label: LAND_USE_LABELS[value] }))}
          />
        </>,
      )}
      {field(
        "type",
        "Building type (buildings)",
        <>
          <Select
            id={id("type")}
            name="type"
            defaultValue={filters.buildingType ?? ""}
            placeholder="Any"
            options={buildingTypes.map((type) => ({ value: type.slug, label: type.name }))}
          />
        </>,
      )}
      {field(
        "bedrooms",
        "Bedrooms (buildings)",
        <>
          <Select
            id={id("bedrooms")}
            name="bedrooms"
            defaultValue={filters.bedrooms?.toString() ?? ""}
            placeholder="Any"
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+` }))}
          />
        </>,
      )}
      {field(
        "availability",
        "Availability",
        <>
          <Select
            id={id("availability")}
            name="availability"
            defaultValue={filters.availability === "all" ? "" : filters.availability}
            placeholder="Show all"
            options={[
              { value: "available", label: "Available only" },
              { value: "unavailable", label: "Unavailable only" },
            ]}
          />
        </>,
      )}
      {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
      <div className="flex flex-col gap-3 pt-2">
        <Button type="submit">Show results</Button>
        <Link
          href="/properties"
          className="self-start text-small text-stone underline underline-offset-4 hover:text-ink"
        >
          Clear all filters
        </Link>
      </div>
    </form>
  );
}
