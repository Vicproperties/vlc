import { describe, expect, it } from "vitest";
import { activeFilters, listingsHref, parseListingFilters } from "@/features/listings/filters";

describe("listing filters from the URL", () => {
  it("defaults to everything, newest first", () => {
    expect(parseListingFilters({})).toMatchObject({
      q: "",
      kind: null,
      state: null,
      availability: "all",
      sort: "newest",
      page: 1,
    });
  });

  it("keeps valid values", () => {
    const filters = parseListingFilters({
      q: "  lekki   duplex ",
      kind: "building",
      purpose: "rent",
      state: "Lagos",
      type: "duplex",
      min_price: "1,000,000",
      max_price: "5000000",
      bedrooms: "3",
      availability: "available",
      sort: "price_asc",
      page: "2",
    });
    expect(filters).toMatchObject({
      q: "lekki duplex",
      kind: "building",
      purpose: "rent",
      state: "Lagos",
      buildingType: "duplex",
      minPrice: 1_000_000,
      maxPrice: 5_000_000,
      bedrooms: 3,
      availability: "available",
      sort: "price_asc",
      page: 2,
    });
  });

  it("drops anything unknown or unsafe", () => {
    const filters = parseListingFilters({
      kind: "castle",
      state: "<script>",
      type: "../../etc",
      min_price: "abc",
      bedrooms: "99",
      sort: "drop table",
      page: "-3",
      availability: "maybe",
    });
    expect(filters).toMatchObject({
      kind: null,
      state: null,
      buildingType: null,
      minPrice: null,
      bedrooms: null,
      sort: "newest",
      page: 1,
      availability: "all",
    });
  });

  it("ignores filters that do not apply to the chosen type and swaps reversed prices", () => {
    const land = parseListingFilters({ kind: "land", bedrooms: "3", type: "duplex", land_use: "commercial" });
    expect(land).toMatchObject({ bedrooms: null, buildingType: null, landUse: "commercial" });
    const building = parseListingFilters({ kind: "building", land_use: "commercial" });
    expect(building.landUse).toBeNull();
    const prices = parseListingFilters({ min_price: "9000", max_price: "1000" });
    expect([prices.minPrice, prices.maxPrice]).toEqual([1000, 9000]);
  });

  it("uses the first value of repeated parameters", () => {
    expect(parseListingFilters({ state: ["Lagos", "Ogun"] }).state).toBe("Lagos");
  });
});

describe("listing URLs", () => {
  it("round-trips filters and resets the page on change", () => {
    const filters = parseListingFilters({ state: "Ogun", purpose: "sale", page: "3" });
    expect(listingsHref(filters, { page: 3 })).toBe("/properties?purpose=sale&state=Ogun&page=3");
    expect(listingsHref(filters, { sort: "price_desc" })).toBe("/properties?purpose=sale&state=Ogun&sort=price_desc");
    expect(listingsHref(parseListingFilters({}))).toBe("/properties");
  });

  it("describes active filters with links that remove them", () => {
    const filters = parseListingFilters({ kind: "building", type: "duplex", state: "Lagos", max_price: "50000000" });
    const items = activeFilters(filters, new Map([["duplex", "Duplex"]]));
    expect(items.map((i) => i.label)).toEqual(["Buildings", "Lagos", "Duplex", "Up to ₦50,000,000"]);
    expect(items.find((i) => i.key === "state")?.href).toBe("/properties?kind=building&type=duplex&max_price=50000000");
    // Removing the type also removes filters that only apply to buildings.
    expect(items.find((i) => i.key === "kind")?.href).toBe("/properties?state=Lagos&max_price=50000000");
  });
});
