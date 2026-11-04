import { describe, expect, it } from "vitest";
import { parseImportCsv, templateCsv } from "@/features/properties/import/csv";
import { parseGoogleMapsUrl, parseNaira, parseYouTubeId } from "@/features/properties/links";
import { matchNigerianState, NIGERIAN_STATES } from "@/features/properties/options";
import { parsePropertyInput, publishProblems } from "@/features/properties/schemas";
import { richTextToPlain, sanitizeRichText } from "@/lib/rich-text";

describe("YouTube links", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts the id from %s", (input, id) => {
    expect(parseYouTubeId(input)).toBe(id);
  });

  it.each(["https://vimeo.com/123", "https://evil.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "short", ""])(
    "rejects %s",
    (input) => {
      expect(parseYouTubeId(input)).toBeNull();
    },
  );
});

describe("Google Maps links", () => {
  it.each([
    "https://maps.app.goo.gl/AbCdEf123",
    "https://www.google.com/maps/place/Lekki/@6.4,3.5,15z",
    "https://maps.google.com/?q=6.4,3.5",
    "https://www.google.com.ng/maps/place/Abuja",
  ])("accepts %s", (input) => {
    expect(parseGoogleMapsUrl(input)).not.toBeNull();
  });

  it.each([
    "http://maps.app.goo.gl/AbCdEf123",
    "https://evil.com/maps",
    "https://www.google.com/search?q=x",
    "https://user:pass@maps.google.com/",
    "javascript:alert(1)",
  ])("rejects %s", (input) => {
    expect(parseGoogleMapsUrl(input)).toBeNull();
  });
});

describe("naira amounts", () => {
  it("accepts formatted whole naira", () => {
    expect(parseNaira("25,000,000")).toBe(25_000_000);
    expect(parseNaira("₦ 1 500 000")).toBe(1_500_000);
    expect(parseNaira("")).toBeNull();
  });
  it("rejects decimals, negatives and text", () => {
    expect(parseNaira("1500.50")).toBeNaN();
    expect(parseNaira("-5")).toBeNaN();
    expect(parseNaira("about 5m")).toBeNaN();
  });
});

describe("Nigerian states", () => {
  it("has 36 states plus the FCT", () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
  });
  it("matches common spellings", () => {
    expect(matchNigerianState("lagos state")).toBe("Lagos");
    expect(matchNigerianState("FCT")).toBe("Federal Capital Territory");
    expect(matchNigerianState("Abuja")).toBe("Federal Capital Territory");
    expect(matchNigerianState("Texas")).toBeNull();
  });
});

describe("property validation", () => {
  const base = { title: "Plot in Lekki", purpose: "sale" };

  it("accepts a minimal draft", () => {
    expect(parsePropertyInput("land", base).ok).toBe(true);
  });

  it("allows a payment period only for rent or lease", () => {
    const sale = parsePropertyInput("land", { ...base, price_period: "per_year" });
    expect(sale.ok).toBe(false);
    if (!sale.ok) expect(sale.fieldErrors.price_period).toMatch(/rent or lease/);
    expect(parsePropertyInput("building", { ...base, purpose: "rent", price_period: "per_year" }).ok).toBe(true);
  });

  it("requires land size and unit together", () => {
    const result = parsePropertyInput("land", { ...base, land_size: "600" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.land_size_unit).toBeDefined();
    expect(parsePropertyInput("land", { ...base, land_size: "600", land_size_unit: "sqm" }).ok).toBe(true);
  });

  it("requires a lower sales price during a promotion", () => {
    const result = parsePropertyInput("land", {
      ...base,
      promotion_active: "on",
      regular_price: "10,000,000",
      sales_price: "12,000,000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.sales_price).toMatch(/lower/);
  });

  it("rejects unknown states, bad links and invalid numbers", () => {
    const result = parsePropertyInput("building", {
      ...base,
      state: "Texas",
      youtube_video_id: "https://vimeo.com/1",
      google_maps_url: "https://evil.com",
      bedrooms: "three",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors)).toEqual(
        expect.arrayContaining(["state", "youtube_video_id", "google_maps_url", "bedrooms"]),
      );
    }
  });

  it("normalises features, links and prices", () => {
    const result = parsePropertyInput("land", {
      ...base,
      features: "Gated estate\nGood roads\nGated estate",
      youtube_video_id: "https://youtu.be/dQw4w9WgXcQ",
      regular_price: "₦25,000,000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.features).toEqual(["Gated estate", "Good roads"]);
      expect(result.data.youtube_video_id).toBe("dQw4w9WgXcQ");
      expect(result.data.regular_price).toBe(25_000_000);
    }
  });

  it("lists what is missing before publishing", () => {
    expect(
      publishProblems({
        regular_price: null,
        sales_price: null,
        state: null,
        location_text: null,
        city: null,
        description: null,
        imageCount: 0,
      }),
    ).toHaveLength(5);
  });
});

describe("formatted text sanitising", () => {
  it("keeps the allowed formats", () => {
    const html = "<h3>Highlights</h3><p><strong>Dry</strong> and <em>flat</em></p><ul><li>Fenced</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("removes scripts, attributes, links and images", () => {
    const dirty =
      '<p onclick="x()" style="color:red">Hi<script>alert(1)</script><a href="javascript:x">link</a><img src=x onerror=alert(1)></p><iframe src="https://evil"></iframe>';
    const clean = sanitizeRichText(dirty);
    expect(clean).toBe("<p>Hilink</p>");
  });

  it("produces plain text for search", () => {
    expect(richTextToPlain("<h3>A</h3><p>B &amp; C</p><ul><li>D</li></ul>")).toBe("A\nB & C\nD");
  });
});

describe("CSV import", () => {
  const lookups = {
    estates: new Map([["palm grove", "11111111-1111-4111-8111-111111111111"]]),
    buildingTypes: new Map([["duplex", "22222222-2222-4222-8222-222222222222"]]),
  };

  it("templates differ by kind", () => {
    expect(templateCsv("land")).toContain("land_use");
    expect(templateCsv("land")).not.toContain("bedrooms");
    expect(templateCsv("building")).toContain("bedrooms");
  });

  it("parses valid rows with friendly values", () => {
    const csv = [
      "title,purpose,state,location,estate,regular_price,land_size,land_size_unit,features,payment_period,description",
      'Plot A,for sale,Lagos State,Lekki,Palm Grove,"25,000,000",600,Square Metres,Fenced;Dry,,"Line one\n\nLine two"',
      "Flat B,rent,FCT,Wuse,,1200000,,,,per annum,",
    ].join("\n");
    const result = parseImportCsv(csv, "land", lookups);
    expect(result.headerErrors).toEqual([]);
    const [a, b] = result.rows;
    expect(a.errors).toEqual([]);
    expect(a.input?.state).toBe("Lagos");
    expect(a.input?.estate_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(a.input?.land_size_unit).toBe("sqm");
    expect(a.input?.features).toEqual(["Fenced", "Dry"]);
    expect(a.input?.description_html).toBe("<p>Line one</p><p>Line two</p>");
    expect(b.errors).toEqual([]);
    expect(b.input?.price_period).toBe("per_year");
    expect(b.input?.state).toBe("Federal Capital Territory");
  });

  it("reports row errors with the column name", () => {
    const csv = ["title,purpose,state,estate,regular_price", "X,swap,Texas,Unknown Estate,=1+1"].join("\n");
    const [row] = parseImportCsv(csv, "land", lookups).rows;
    expect(row.input).toBeNull();
    expect(row.errors.join(" ")).toMatch(/state:/);
    expect(row.errors.join(" ")).toMatch(/estate:/);
    expect(row.errors.join(" ")).toMatch(/regular_price: cells cannot start/);
    expect(row.errors.join(" ")).toMatch(/purpose:/);
  });

  it("rejects wrong templates and missing columns", () => {
    expect(parseImportCsv("title,purpose,bedrooms\nA,sale,3", "land", lookups).headerErrors[0]).toMatch(
      /Unknown column/,
    );
    expect(parseImportCsv("title\nA", "land", lookups).headerErrors.join(" ")).toMatch(/Missing required/);
    expect(parseImportCsv("title,purpose\n", "land", lookups).headerErrors.join(" ")).toMatch(/no property rows/);
  });

  it("flags repeated rows in the same file", () => {
    const csv = ["title,purpose,location", "Plot A,sale,Lekki", "plot a,sale,lekki"].join("\n");
    const rows = parseImportCsv(csv, "land", lookups).rows;
    expect(rows[1].sameFileAs).toBe(2);
  });

  it("limits the number of rows", () => {
    const csv = ["title,purpose", ...Array.from({ length: 501 }, (_, i) => `Plot ${i},sale`)].join("\n");
    expect(parseImportCsv(csv, "land", lookups).headerErrors.join(" ")).toMatch(/at most 500/);
  });
});
