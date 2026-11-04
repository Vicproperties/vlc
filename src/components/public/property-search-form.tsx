import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PURPOSE_LABELS, PURPOSES } from "@/features/properties/options";

/** Homepage quick search. A plain GET form to /properties: works without JavaScript. */
export function PropertySearchForm() {
  return (
    <form
      action="/properties"
      method="get"
      role="search"
      aria-label="Search properties"
      className="grid gap-3 border border-line bg-paper p-4 shadow-overlay sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end sm:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="home-q" className="text-caption font-medium text-stone">
          Location or keyword
        </label>
        <Input id="home-q" name="q" type="search" maxLength={100} placeholder="e.g. Lekki, duplex, farmland" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="home-kind" className="text-caption font-medium text-stone">
          Type
        </label>
        <Select
          id="home-kind"
          name="kind"
          placeholder="Any"
          options={[
            { value: "land", label: "Land" },
            { value: "building", label: "Buildings" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="home-purpose" className="text-caption font-medium text-stone">
          Purpose
        </label>
        <Select
          id="home-purpose"
          name="purpose"
          placeholder="Any"
          options={PURPOSES.map((value) => ({ value, label: PURPOSE_LABELS[value] }))}
        />
      </div>
      <Button type="submit" leadingIcon={<Search className="size-4" strokeWidth={1.75} aria-hidden="true" />}>
        Search
      </Button>
    </form>
  );
}
