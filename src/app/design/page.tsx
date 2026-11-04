import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Inbox } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Radio } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { DiscountLabel, Price } from "@/components/ui/price";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton, StatusText } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { LAND_SIZE_UNIT_OPTIONS } from "@/lib/format";
import { DesignInteractive } from "./design-interactive";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

const swatches = [
  ["paper", "bg-paper"],
  ["surface", "bg-surface"],
  ["ink", "bg-ink"],
  ["stone", "bg-stone"],
  ["line", "bg-line"],
  ["line-strong", "bg-line-strong"],
  ["forest", "bg-forest"],
  ["forest-deep", "bg-forest-deep"],
  ["forest-tint", "bg-forest-tint"],
  ["danger", "bg-danger"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-8 border-t border-line py-14">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}

/** Example values below are visual samples for this development page only — not business data. */
const samplePricing = {
  regularPrice: 30_000_000,
  salesPrice: 25_500_000,
  instalmentPrice: 27_000_000,
  instalmentNote: "Sample note: 30% initial deposit, balance over 12 months.",
  promotionActive: true,
  pricePeriod: null,
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main id="main" className="container-content py-16">
      <p className="mb-4 eyebrow">Development only</p>
      <h1 className="text-h1">Design system</h1>
      <p className="mt-4 mb-14 max-w-2xl text-body-lg text-stone">
        Direction A — Editorial Heritage. Every component and state used across the website and dashboard.
      </p>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {swatches.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`h-20 border border-line ${cls}`} />
              <p className="text-small font-medium">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-6">
          <p className="eyebrow">Eyebrow label</p>
          <p className="font-serif text-display">Display</p>
          <p className="font-serif text-h1">Heading one</p>
          <p className="font-serif text-h2">Heading two</p>
          <p className="font-serif text-h3">Heading three</p>
          <p className="text-h4 font-semibold">Heading four</p>
          <p className="max-w-prose text-body-lg">
            Body large. Generous line height and a restrained measure keep long descriptions comfortable to read on
            every screen size.
          </p>
          <p className="max-w-prose text-body">Body. The default size for interface text and form content.</p>
          <p className="text-small text-stone">Small, secondary text.</p>
          <p className="text-caption text-stone">Caption text.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="link">Text link</Button>
          <Button variant="danger">Delete</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg" trailingIcon={<ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />}>
            Large with icon
          </Button>
          <ButtonLink href="/design" variant="secondary">
            Link styled as button
          </ButtonLink>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-3xl gap-8 md:grid-cols-2">
          <FormField id="d-name" label="Full name" required>
            <Input id="d-name" autoComplete="name" />
          </FormField>
          <FormField id="d-email" label="Email address" hint="We will only use this to reply to you.">
            <Input id="d-email" type="email" aria-describedby={fieldDescribedBy("d-email", { hint: true })} />
          </FormField>
          <FormField id="d-error" label="Land size" error="Enter a number greater than zero.">
            <Input
              id="d-error"
              inputMode="decimal"
              defaultValue="-5"
              aria-invalid="true"
              aria-describedby={fieldDescribedBy("d-error", { error: true })}
            />
          </FormField>
          <FormField id="d-unit" label="Unit">
            <Select id="d-unit" options={LAND_SIZE_UNIT_OPTIONS} placeholder="Select unit" />
          </FormField>
          <FormField id="d-disabled" label="Disabled">
            <Input id="d-disabled" disabled defaultValue="Not editable" />
          </FormField>
          <FormField id="d-optional" label="Dimensions" optionalLabel>
            <Input id="d-optional" placeholder="e.g. 18m x 36m" />
          </FormField>
          <FormField id="d-msg" label="Message" className="md:col-span-2">
            <Textarea id="d-msg" />
          </FormField>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-small font-medium">Checkboxes</legend>
            <Checkbox id="d-c1" label="Residential" defaultChecked />
            <Checkbox id="d-c2" label="Commercial" description="Offices, retail and mixed premises." />
            <Checkbox id="d-c3" label="Disabled option" disabled />
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-small font-medium">Radio buttons</legend>
            <Radio id="d-r1" name="purpose" label="Sale" defaultChecked />
            <Radio id="d-r2" name="purpose" label="Rent" />
            <Radio id="d-r3" name="purpose" label="Lease" />
          </fieldset>
        </div>
      </Section>

      <DesignInteractive />

      <Section title="Pricing">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Active promotion</p>
            <div className="relative aspect-[4/3] bg-line">
              <DiscountLabel percent={15} className="absolute top-4 left-4" />
            </div>
            <Price pricing={samplePricing} showInstalment />
          </div>
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Promotion inactive</p>
            <Price pricing={{ ...samplePricing, promotionActive: false }} />
          </div>
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Rent with period</p>
            <Price
              pricing={{
                regularPrice: 4_500_000,
                salesPrice: null,
                instalmentPrice: null,
                instalmentNote: null,
                promotionActive: false,
                pricePeriod: "per_year",
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Status text">
        <div className="flex flex-wrap gap-8">
          <StatusText tone="success">Published</StatusText>
          <StatusText>Draft</StatusText>
          <StatusText tone="warning">Pending</StatusText>
          <StatusText tone="accent">Confirmed</StatusText>
          <StatusText tone="danger">Cancelled</StatusText>
        </div>
      </Section>

      <Section title="Table">
        <Table>
          <THead>
            <tr>
              <TH>Title</TH>
              <TH>Kind</TH>
              <TH>Status</TH>
              <TH className="text-right">Updated</TH>
            </tr>
          </THead>
          <TBody>
            {["Sample row one", "Sample row two", "Sample row three"].map((title, i) => (
              <TR key={title}>
                <TD className="font-medium">{title}</TD>
                <TD>Land</TD>
                <TD>
                  <StatusText tone={i === 0 ? "success" : "neutral"}>{i === 0 ? "Published" : "Draft"}</StatusText>
                </TD>
                <TD className="text-right text-stone">—</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={4} totalPages={12} hrefFor={(p) => `/design?page=${p}`} />
      </Section>

      <Section title="Loading, empty and error states">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <EmptyState
            icon={Inbox}
            title="No properties found"
            description="Try removing a filter or searching for a different location."
            action={<Button variant="secondary">Clear filters</Button>}
          />
          <ErrorState
            title="We could not load properties"
            description="Please check your connection and try again."
            action={<Button variant="link">Retry</Button>}
          />
        </div>
      </Section>
    </main>
  );
}
