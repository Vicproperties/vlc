"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PhoneInput } from "@/components/ui/phone-input";
import { submitContactAction } from "@/features/enquiries/public-actions";
import { type EnquiryFormState } from "@/features/enquiries/schemas";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";
import { Turnstile } from "./turnstile";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactAction, { status: "idle" } as EnquiryFormState);
  const [attempt, setAttempt] = useState(0);
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState(state.values?.phone ?? "");
  const [another, setAnother] = useState(false);

  if (state.status === "success" && !another) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="font-serif text-h3 text-ink">Thank you. Your message has been sent.</p>
        <p className="text-body text-stone">
          Reference <strong className="font-mono tracking-wider text-ink">{state.reference}</strong>. We will reply to
          the email address you gave.
        </p>
        <button
          type="button"
          onClick={() => setAnother(true)}
          className="self-start text-small text-brand underline underline-offset-4"
        >
          Send another message
        </button>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const a11y = (name: string, hint?: unknown) => ({
    id: `contact-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldDescribedBy(`contact-${name}`, { hint, error: errors[name] }),
  });

  return (
    <form
      action={(formData) => {
        setAttempt((n) => n + 1);
        setAnother(false);
        formAction(formData);
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id="contact-name" label="Full name" error={errors.name} required>
          <Input {...a11y("name")} autoComplete="name" defaultValue={v.name} maxLength={120} required />
        </FormField>
        <FormField id="contact-email" label="Email" error={errors.email} required>
          <Input {...a11y("email")} type="email" autoComplete="email" defaultValue={v.email} maxLength={254} required />
        </FormField>
      </div>
      <FormField id="contact-phone" label="Phone number" error={errors.phone} optionalLabel>
        <PhoneInput
          {...a11y("phone")}
          country={country}
          onCountryChange={setCountry}
          value={phone}
          onValueChange={setPhone}
        />
      </FormField>
      <input type="hidden" name="phone_country" value={country} />
      <FormField id="contact-subject" label="Subject" error={errors.subject} optionalLabel>
        <Input {...a11y("subject")} defaultValue={v.subject} maxLength={200} />
      </FormField>
      <FormField id="contact-message" label="Message" error={errors.message} required>
        <Textarea {...a11y("message")} rows={6} defaultValue={v.message} maxLength={5000} required />
      </FormField>

      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Checkbox
          {...a11y("consent")}
          value="on"
          label={
            <>
              I agree that my details are used to reply to this message, as described in the{" "}
              <Link href="/privacy-policy" className="underline underline-offset-4">
                privacy policy
              </Link>
              .
            </>
          }
        />
        {errors.consent && (
          <p id="contact-consent-error" className="text-caption text-danger" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      <Turnstile key={attempt} action="contact" />
      <Button type="submit" loading={pending} className="self-start">
        Send message
      </Button>
    </form>
  );
}
