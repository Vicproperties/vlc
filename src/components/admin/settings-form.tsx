"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PhoneInput } from "@/components/ui/phone-input";
import { type SettingsFormState, saveSiteSettingsAction } from "@/features/settings/actions";
import { SOCIAL_NETWORKS } from "@/features/settings/networks";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";

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

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(saveSiteSettingsAction, { status: "idle" } as SettingsFormState);
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const v = (key: string) => values[key] ?? "";
  const a11y = (name: string, hint?: unknown) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldDescribedBy(name, { hint, error: errors[name] }),
  });

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}

      <Section title="Company" description="Shown in the footer and on the contact page.">
        <FormField id="company_name" label="Registered company name" error={errors.company_name} optionalLabel>
          <Input {...a11y("company_name")} defaultValue={v("company_name")} maxLength={150} />
        </FormField>
        <FormField
          id="tagline"
          label="Short description"
          hint="One sentence for the footer."
          error={errors.tagline}
          optionalLabel
        >
          <Input {...a11y("tagline", true)} defaultValue={v("tagline")} maxLength={200} />
        </FormField>
        <FormField id="address" label="Office address" error={errors.address} optionalLabel>
          <Textarea {...a11y("address")} rows={3} defaultValue={v("address")} maxLength={400} />
        </FormField>
      </Section>

      <Section title="Contact details">
        <PhoneField
          name="phone_primary"
          label="Main phone number"
          initial={v("phone_primary")}
          error={errors.phone_primary}
        />
        <PhoneField
          name="phone_secondary"
          label="Other phone number"
          initial={v("phone_secondary")}
          error={errors.phone_secondary}
        />
        <PhoneField
          name="whatsapp_number"
          label="WhatsApp number"
          hint="Used for the WhatsApp buttons on property pages and after inspection requests."
          initial={v("whatsapp_number")}
          error={errors.whatsapp_number}
        />
        <FormField id="email_primary" label="Email address" error={errors.email_primary} optionalLabel>
          <Input {...a11y("email_primary")} type="email" defaultValue={v("email_primary")} maxLength={254} />
        </FormField>
        <FormField
          id="business_hours"
          label="Opening hours"
          hint="One line per entry, e.g. “Monday to Friday: 9am to 5pm”."
          error={errors.business_hours}
          optionalLabel
        >
          <Textarea {...a11y("business_hours", true)} rows={4} defaultValue={v("business_hours")} />
        </FormField>
        <FormField
          id="map_embed_url"
          label="Map on the contact page"
          hint='In Google Maps: Share → Embed a map → copy only the link inside src="…".'
          error={errors.map_embed_url}
          optionalLabel
        >
          <Input {...a11y("map_embed_url", true)} type="url" defaultValue={v("map_embed_url")} />
        </FormField>
      </Section>

      <Section title="Social media" description="Full https:// links. Leave empty to hide.">
        <div className="grid gap-6 sm:grid-cols-2">
          {SOCIAL_NETWORKS.map((network) => (
            <FormField
              key={network.key}
              id={`social_${network.key}`}
              label={network.label}
              error={errors[`social_${network.key}`]}
            >
              <Input
                {...a11y(`social_${network.key}`)}
                type="url"
                inputMode="url"
                defaultValue={v(`social_${network.key}`)}
                placeholder="https://"
              />
            </FormField>
          ))}
        </div>
      </Section>

      <Section title="Search engines" description="Used when a page has no title or description of its own.">
        <FormField id="default_seo_title" label="Default title" error={errors.default_seo_title} optionalLabel>
          <Input {...a11y("default_seo_title")} defaultValue={v("default_seo_title")} maxLength={120} />
        </FormField>
        <FormField
          id="default_seo_description"
          label="Default description"
          error={errors.default_seo_description}
          optionalLabel
        >
          <Textarea
            {...a11y("default_seo_description")}
            rows={3}
            defaultValue={v("default_seo_description")}
            maxLength={320}
          />
        </FormField>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-line bg-paper/95 px-4 py-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <Button type="submit" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

function PhoneField({
  name,
  label,
  hint,
  initial,
  error,
}: {
  name: string;
  label: string;
  hint?: string;
  initial: string;
  error?: string;
}) {
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [value, setValue] = useState(initial);
  return (
    <FormField id={name} label={label} hint={hint} error={error} optionalLabel>
      <PhoneInput
        id={name}
        name={name}
        country={country}
        onCountryChange={setCountry}
        value={value}
        onValueChange={setValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(name, { hint, error })}
      />
      <input type="hidden" name={`${name}_country`} value={country} />
    </FormField>
  );
}
