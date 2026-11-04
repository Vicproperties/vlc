"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select, type SelectOption } from "@/components/ui/select";
import type { PropertyFormState } from "@/features/properties/actions";
import { parseGoogleMapsUrl, parseNaira, parseYouTubeId } from "@/features/properties/links";
import {
  LAND_USE_LABELS,
  LAND_USES,
  NIGERIAN_STATES,
  PRICE_PERIOD_LABELS,
  PURPOSE_LABELS,
  PURPOSES,
  type PropertyKind,
} from "@/features/properties/options";
import { calculateDiscountPercent } from "@/features/properties/pricing";
import { formatNaira, LAND_SIZE_UNIT_OPTIONS, PRICE_PERIODS } from "@/lib/format";
import { RichTextEditor } from "./rich-text-editor";

type Action = (state: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;

const stateOptions: SelectOption[] = NIGERIAN_STATES.map((state) => ({
  value: state,
  label: state === "Federal Capital Territory" ? "Federal Capital Territory (Abuja)" : state,
}));

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[14rem_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-ink">{title}</h2>
        {description && <p className="text-small text-stone">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </section>
  );
}

export function PropertyForm({
  kind,
  action,
  initial,
  estates,
  buildingTypes,
  submitLabel,
}: {
  kind: PropertyKind;
  action: Action;
  initial: Record<string, string>;
  estates: SelectOption[];
  buildingTypes: SelectOption[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as PropertyFormState);
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const v = (name: string) => values[name] ?? "";

  // Controlled where the form reacts while typing.
  const [purpose, setPurpose] = useState(v("purpose"));
  const [regular, setRegular] = useState(v("regular_price"));
  const [sales, setSales] = useState(v("sales_price"));
  const [promotion, setPromotion] = useState(v("promotion_active") === "on");
  const [youtube, setYoutube] = useState(v("youtube_video_id"));
  const [maps, setMaps] = useState(v("google_maps_url"));
  const [featured, setFeatured] = useState(v("is_featured") === "on");

  const regularValue = parseNaira(regular);
  const salesValue = parseNaira(sales);
  const discount = promotion
    ? calculateDiscountPercent(
        Number.isNaN(regularValue) ? null : regularValue,
        Number.isNaN(salesValue) ? null : salesValue,
      )
    : null;
  const youtubeId = youtube.trim() ? parseYouTubeId(youtube) : null;
  const mapsValid = maps.trim() ? parseGoogleMapsUrl(maps) !== null : true;
  const allowsPeriod = purpose === "rent" || purpose === "lease";

  const field = (
    name: string,
    label: string,
    control: ReactNode,
    opts: { hint?: ReactNode; required?: boolean } = {},
  ) => (
    <FormField id={name} label={label} hint={opts.hint} error={errors[name]} required={opts.required}>
      {control}
    </FormField>
  );
  const a11y = (name: string, hint?: unknown) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldDescribedBy(name, { hint, error: errors[name] }),
  });

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}

      <Section title="Basics" description="What visitors see first.">
        {field("title", "Title", <Input {...a11y("title")} defaultValue={v("title")} maxLength={200} required />, {
          required: true,
        })}
        {field(
          "purpose",
          "Purpose",
          <Select
            {...a11y("purpose")}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            options={PURPOSES.map((value) => ({ value, label: PURPOSE_LABELS[value] }))}
            placeholder="Choose…"
            required
          />,
          { required: true },
        )}
        <FormField id="description" label="Description" error={errors.description_html}>
          <RichTextEditor
            id="description"
            name="description_html"
            labelledBy="description-label"
            defaultValue={v("description_html")}
            invalid={!!errors.description_html}
            describedBy={fieldDescribedBy("description", { error: errors.description_html })}
          />
        </FormField>
      </Section>

      <Section title="Location">
        <div className="grid gap-6 sm:grid-cols-2">
          {field(
            "state",
            "State",
            <Select
              {...a11y("state")}
              defaultValue={v("state")}
              options={stateOptions}
              placeholder="Choose a state…"
            />,
          )}
          {field("city", "City or area", <Input {...a11y("city")} defaultValue={v("city")} maxLength={100} />)}
        </div>
        {field(
          "location_text",
          "Location description",
          <Input {...a11y("location_text", true)} defaultValue={v("location_text")} maxLength={300} />,
          { hint: "Shown on listings, e.g. “Off Admiralty Way, Lekki Phase 1”." },
        )}
        {field("address", "Street address", <Input {...a11y("address")} defaultValue={v("address")} maxLength={300} />)}
        {field(
          "google_maps_url",
          "Google Maps link",
          <Input
            {...a11y("google_maps_url", true)}
            type="url"
            inputMode="url"
            value={maps}
            onChange={(event) => setMaps(event.target.value)}
          />,
          {
            hint: mapsValid
              ? "Optional. Open the place in Google Maps, choose Share, and paste the link."
              : "This is not a Google Maps link.",
          },
        )}
        {field(
          "estate_id",
          "Estate",
          <Select
            {...a11y("estate_id", true)}
            defaultValue={v("estate_id")}
            options={estates}
            placeholder="Not part of an estate"
          />,
          { hint: "Internal only — never shown on the website." },
        )}
      </Section>

      {kind === "land" ? (
        <Section title="Land details">
          {field(
            "land_use",
            "Land use",
            <Select
              {...a11y("land_use")}
              defaultValue={v("land_use")}
              options={LAND_USES.map((value) => ({ value, label: LAND_USE_LABELS[value] }))}
              placeholder="Choose…"
            />,
          )}
          <SizeFields errors={errors} v={v} a11y={a11y} />
          <div className="grid gap-6 sm:grid-cols-2">
            {field(
              "dimensions",
              "Dimensions",
              <Input {...a11y("dimensions", true)} defaultValue={v("dimensions")} maxLength={120} />,
              {
                hint: "e.g. 18m × 36m",
              },
            )}
            {field(
              "available_plots",
              "Available plots",
              <Input {...a11y("available_plots")} inputMode="numeric" defaultValue={v("available_plots")} />,
            )}
          </div>
        </Section>
      ) : (
        <Section title="Building details">
          {field(
            "building_type_id",
            "Building type",
            <Select
              {...a11y("building_type_id")}
              defaultValue={v("building_type_id")}
              options={buildingTypes}
              placeholder="Choose…"
            />,
          )}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {(["bedrooms", "bathrooms", "toilets", "parking_spaces"] as const).map((name) =>
              field(
                name,
                { bedrooms: "Bedrooms", bathrooms: "Bathrooms", toilets: "Toilets", parking_spaces: "Parking" }[name],
                <Input {...a11y(name)} inputMode="numeric" defaultValue={v(name)} />,
              ),
            )}
          </div>
          <SizeFields errors={errors} v={v} a11y={a11y} hint="Optional: size of the plot the building stands on." />
        </Section>
      )}

      <Section title="Pricing" description="Whole naira. The discount is always calculated automatically.">
        <div className="grid gap-6 sm:grid-cols-2">
          {field(
            "regular_price",
            "Regular price (₦)",
            <Input
              {...a11y("regular_price")}
              inputMode="numeric"
              value={regular}
              onChange={(event) => setRegular(event.target.value)}
            />,
          )}
          {field(
            "sales_price",
            "Sales price (₦)",
            <Input
              {...a11y("sales_price", true)}
              inputMode="numeric"
              value={sales}
              onChange={(event) => setSales(event.target.value)}
            />,
            { hint: "When set, this is the main price shown." },
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Checkbox
            id="promotion_active"
            name="promotion_active"
            value="on"
            checked={promotion}
            onChange={(event) => setPromotion(event.target.checked)}
            label="Promotion active"
            description="Shows the regular price crossed out with the discount."
          />
          <p className="text-small text-stone" aria-live="polite">
            {promotion
              ? discount !== null && regularValue && salesValue
                ? `Visitors will see ${formatNaira(salesValue)}, with ${formatNaira(regularValue)} crossed out (${discount}% off).`
                : "Enter a regular price and a lower sales price to show a discount."
              : "No discount is shown while the promotion is off."}
          </p>
        </div>
        {allowsPeriod &&
          field(
            "price_period",
            "Payment period",
            <Select
              {...a11y("price_period")}
              defaultValue={v("price_period")}
              options={PRICE_PERIODS.map((value) => ({ value, label: PRICE_PERIOD_LABELS[value] }))}
              placeholder="Not specified"
            />,
          )}
        <div className="grid gap-6 sm:grid-cols-2">
          {field(
            "instalment_price",
            "Instalment price (₦)",
            <Input {...a11y("instalment_price")} inputMode="numeric" defaultValue={v("instalment_price")} />,
          )}
          {field(
            "instalment_note",
            "Instalment terms",
            <Input {...a11y("instalment_note", true)} defaultValue={v("instalment_note")} maxLength={2000} />,
            { hint: "e.g. 30% deposit, balance over 12 months" },
          )}
        </div>
      </Section>

      <Section title="Features and documents">
        {field("features", "Features", <Textarea {...a11y("features", true)} rows={5} defaultValue={v("features")} />, {
          hint: "One per line, e.g. Gated estate, Good road network.",
        })}
        {field(
          "title_documentation",
          "Title documentation",
          <Input {...a11y("title_documentation", true)} defaultValue={v("title_documentation")} maxLength={300} />,
          { hint: "e.g. Certificate of Occupancy, Governor’s Consent" },
        )}
      </Section>

      <Section title="Video">
        {field(
          "youtube_video_id",
          "YouTube video",
          <Input
            {...a11y("youtube_video_id", true)}
            inputMode="url"
            value={youtube}
            onChange={(event) => setYoutube(event.target.value)}
          />,
          {
            hint: youtube.trim()
              ? youtubeId
                ? `Video found (${youtubeId}).`
                : "This is not a YouTube video link."
              : "Optional. Paste the video link from YouTube.",
          },
        )}
      </Section>

      <Section title="Visibility and search engines">
        <Checkbox
          id="is_featured"
          name="is_featured"
          value="on"
          checked={featured}
          onChange={(event) => setFeatured(event.target.checked)}
          label="Feature on the homepage"
        />
        {featured &&
          field(
            "featured_order",
            "Featured order",
            <Input {...a11y("featured_order", true)} inputMode="numeric" defaultValue={v("featured_order")} />,
            {
              hint: "Lower numbers appear first.",
            },
          )}
        {field(
          "seo_title",
          "SEO title",
          <Input {...a11y("seo_title", true)} defaultValue={v("seo_title")} maxLength={120} />,
          {
            hint: "Optional. Defaults to the property title.",
          },
        )}
        {field(
          "seo_description",
          "SEO description",
          <Textarea {...a11y("seo_description", true)} rows={3} defaultValue={v("seo_description")} maxLength={320} />,
          { hint: "Optional. Defaults to the start of the description." },
        )}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-line bg-paper/95 px-4 py-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SizeFields({
  errors,
  v,
  a11y,
  hint,
}: {
  errors: Record<string, string>;
  v: (name: string) => string;
  a11y: (name: string, hint?: unknown) => Record<string, unknown>;
  hint?: string;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <FormField id="land_size" label="Land size" hint={hint} error={errors.land_size}>
        <Input {...a11y("land_size", hint)} inputMode="decimal" defaultValue={v("land_size")} />
      </FormField>
      <FormField id="land_size_unit" label="Unit" error={errors.land_size_unit}>
        <Select
          {...a11y("land_size_unit")}
          defaultValue={v("land_size_unit")}
          options={LAND_SIZE_UNIT_OPTIONS}
          placeholder="Choose a unit…"
        />
      </FormField>
    </div>
  );
}
