import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PURPOSE_LABELS, PURPOSES } from "@/features/properties/options";

const MAX_PRICES = [5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000];
const naira = (n: number) => `Up to ₦${n >= 1_000_000 ? `${n / 1_000_000}M` : n.toLocaleString("en-NG")}`;

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Homepage search card. A plain GET form to /properties: works without JavaScript. */
export function PropertySearchForm() {
  return (
    <form
      action="/properties"
      method="get"
      role="search"
      aria-labelledby="home-search-heading"
      className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white p-6 shadow-overlay sm:p-7"
    >
      <h2 id="home-search-heading" className="text-h4">
        Find your perfect property
      </h2>
      <Field id="home-q" label="Location or keyword">
        <div className="relative">
          <Input
            id="home-q"
            name="q"
            type="search"
            maxLength={100}
            placeholder="e.g. Lekki, duplex, farmland"
            className="pr-10"
          />
          <MapPin
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-stone"
            aria-hidden="true"
          />
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="home-kind" label="Property type">
          <Select
            id="home-kind"
            name="kind"
            placeholder="All types"
            options={[
              { value: "land", label: "Land" },
              { value: "building", label: "Buildings" },
            ]}
          />
        </Field>
        <Field id="home-purpose" label="Purpose">
          <Select
            id="home-purpose"
            name="purpose"
            placeholder="Any"
            options={PURPOSES.map((value) => ({ value, label: PURPOSE_LABELS[value] }))}
          />
        </Field>
      </div>
      <Field id="home-max" label="Price range">
        <Select
          id="home-max"
          name="max_price"
          placeholder="Any price"
          options={MAX_PRICES.map((value) => ({ value: String(value), label: naira(value) }))}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full"
        leadingIcon={<Search className="size-4" aria-hidden="true" />}
      >
        Search properties
      </Button>
    </form>
  );
}
