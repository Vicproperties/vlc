import type { Database } from "@/types/database";

type Row = Database["public"]["Tables"]["properties"]["Row"];

/** A stored property as the string values the dashboard form expects. */
export function propertyToFormValues(row: Partial<Row>): Record<string, string> {
  const s = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return {
    title: s(row.title),
    purpose: s(row.purpose),
    description_html: s(row.description_html),
    address: s(row.address),
    city: s(row.city),
    state: s(row.state),
    location_text: s(row.location_text),
    google_maps_url: s(row.google_maps_url),
    estate_id: s(row.estate_id),
    title_documentation: s(row.title_documentation),
    features: (row.features ?? []).join("\n"),
    youtube_video_id: row.youtube_video_id ? `https://youtu.be/${row.youtube_video_id}` : "",
    regular_price: s(row.regular_price),
    sales_price: s(row.sales_price),
    instalment_price: s(row.instalment_price),
    instalment_note: s(row.instalment_note),
    price_period: s(row.price_period),
    promotion_active: row.promotion_active ? "on" : "",
    land_size: s(row.land_size),
    land_size_unit: s(row.land_size_unit),
    is_featured: row.is_featured ? "on" : "",
    featured_order: s(row.featured_order),
    seo_title: s(row.seo_title),
    seo_description: s(row.seo_description),
    land_use: s(row.land_use),
    dimensions: s(row.dimensions),
    available_plots: s(row.available_plots),
    building_type_id: s(row.building_type_id),
    bedrooms: s(row.bedrooms),
    bathrooms: s(row.bathrooms),
    toilets: s(row.toilets),
    parking_spaces: s(row.parking_spaces),
  };
}
