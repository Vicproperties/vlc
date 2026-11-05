"use client";

import Link from "next/link";
import { CalendarCheck, MessageCircle } from "lucide-react";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { type InspectionResult, submitInspectionAction } from "@/features/enquiries/public-actions";
import { lagosToday, MAX_DAYS_AHEAD, PREFERRED_TIME_LABELS, PREFERRED_TIMES } from "@/features/enquiries/schemas";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";
import { Turnstile } from "./turnstile";

interface SavedConfirmation {
  reference: string;
  whatsappUrl: string | null;
  at: number;
}

const STORAGE_PREFIX = "inspection-request:";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

function readSaved(propertyId: string): SavedConfirmation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + propertyId);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedConfirmation;
    return Date.now() - saved.at < KEEP_MS && /^[A-Z0-9]{8}$/.test(saved.reference) ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(propertyId: string, value: SavedConfirmation | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_PREFIX + propertyId, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_PREFIX + propertyId);
  } catch {
    // Storage unavailable (private mode): the confirmation simply is not remembered.
  }
}

const subscribeNoop = () => () => {};

function maxDate(): string {
  const date = new Date(`${lagosToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + MAX_DAYS_AHEAD);
  return date.toISOString().slice(0, 10);
}

/**
 * Inspection request form for a property page. After sending, a confirmation with the
 * reference and (when configured) a WhatsApp chat button is shown. It is remembered on this
 * device for 30 days, so the visitor can come back and reopen the WhatsApp chat.
 */
export function InspectionForm({ propertyId }: { propertyId: string }) {
  const [state, formAction, pending] = useActionState(submitInspectionAction.bind(null, propertyId), {
    status: "idle",
  } as InspectionResult);
  const [attempt, setAttempt] = useState(0);
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState(state.values?.phone ?? "");
  const [dismissed, setDismissed] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const fresh: Omit<SavedConfirmation, "at"> | null =
    state.status === "success" && state.reference
      ? { reference: state.reference, whatsappUrl: state.whatsappUrl ?? null }
      : null;

  // Remember the confirmation on this device so it can be reopened later.
  useEffect(() => {
    if (state.status === "success" && state.reference && state.reference !== "RECEIVED") {
      writeSaved(propertyId, { reference: state.reference, whatsappUrl: state.whatsappUrl ?? null, at: Date.now() });
    }
  }, [propertyId, state]);

  const confirmation = dismissed ? null : (fresh ?? (hydrated ? readSaved(propertyId) : null));

  if (confirmation) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="flex items-center gap-2 font-serif text-h4 text-ink">
          <CalendarCheck className="size-5 text-success" strokeWidth={1.5} aria-hidden="true" />
          Inspection request received
        </p>
        <p className="text-small text-ink">
          Your reference is <strong className="font-mono tracking-wider">{confirmation.reference}</strong>. We will call
          you to confirm a date and time.
        </p>
        {confirmation.whatsappUrl && (
          <a
            href={confirmation.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-brand px-6 text-small font-medium text-white transition-colors hover:bg-brand-deep"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Chat with us on WhatsApp
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            writeSaved(propertyId, null);
            setDismissed(true);
          }}
          className="self-start text-small text-stone underline underline-offset-4 hover:text-ink"
        >
          Make another request
        </button>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const a11y = (name: string, hint?: unknown) => ({
    id: `inspect-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldDescribedBy(`inspect-${name}`, { hint, error: errors[name] }),
  });

  return (
    <form
      action={(formData) => {
        setAttempt((n) => n + 1);
        setDismissed(false);
        formAction(formData);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <h2 className="font-serif text-h4 text-ink">Request an inspection</h2>
      {state.message && <Notice tone="error">{state.message}</Notice>}

      <FormField id="inspect-full_name" label="Full name" error={errors.full_name} required>
        <Input {...a11y("full_name")} autoComplete="name" defaultValue={v.full_name} maxLength={120} required />
      </FormField>
      <FormField id="inspect-phone" label="Phone number" error={errors.phone} required>
        <PhoneInput
          {...a11y("phone")}
          country={country}
          onCountryChange={setCountry}
          value={phone}
          onValueChange={setPhone}
          required
        />
      </FormField>
      <input type="hidden" name="phone_country" value={country} />
      <FormField id="inspect-email" label="Email" error={errors.email} optionalLabel>
        <Input {...a11y("email")} type="email" autoComplete="email" defaultValue={v.email} maxLength={254} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <FormField id="inspect-preferred_date" label="Preferred date" error={errors.preferred_date} optionalLabel>
          <Input
            {...a11y("preferred_date")}
            type="date"
            min={hydrated ? lagosToday() : undefined}
            max={hydrated ? maxDate() : undefined}
            defaultValue={v.preferred_date}
          />
        </FormField>
        <FormField id="inspect-preferred_time" label="Preferred time" error={errors.preferred_time} optionalLabel>
          <Select
            {...a11y("preferred_time")}
            defaultValue={v.preferred_time ?? ""}
            placeholder="Any time"
            options={PREFERRED_TIMES.map((value) => ({ value, label: PREFERRED_TIME_LABELS[value] }))}
          />
        </FormField>
      </div>
      <FormField id="inspect-message" label="Message" error={errors.message} optionalLabel>
        <Textarea {...a11y("message")} rows={3} defaultValue={v.message} maxLength={3000} />
      </FormField>

      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="inspect-website">Website</label>
        <input id="inspect-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Checkbox
          {...a11y("consent")}
          value="on"
          label={
            <>
              I agree to be contacted about this request, as described in the{" "}
              <Link href="/privacy-policy" className="underline underline-offset-4">
                privacy policy
              </Link>
              .
            </>
          }
        />
        {errors.consent && (
          <p id="inspect-consent-error" className="text-caption text-danger" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      <Turnstile key={attempt} action="inspection" />
      <Button type="submit" loading={pending} className="w-full">
        Send request
      </Button>
    </form>
  );
}
