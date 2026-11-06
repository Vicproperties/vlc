"use client";

import { useActionState, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  type CustomerFormState,
  deleteAccountAction,
  startGoogleSignInAction,
  updateProfileAction,
} from "@/features/customers/actions";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function GoogleSignInForm({ next, favourite }: { next: string; favourite: string | null }) {
  const [state, formAction, pending] = useActionState(startGoogleSignInAction, { status: "idle" } as CustomerFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <input type="hidden" name="next" value={next} />
      {favourite && <input type="hidden" name="favourite" value={favourite} />}
      <Button type="submit" variant="secondary" loading={pending} leadingIcon={<GoogleMark />} className="w-full">
        Continue with Google
      </Button>
    </form>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, { status: "idle" } as CustomerFormState);
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phoneValue, setPhoneValue] = useState(phone);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <FormField id="full_name" label="Full name" error={errors.full_name} required>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          maxLength={120}
          autoComplete="name"
          aria-invalid={errors.full_name ? true : undefined}
          aria-describedby={fieldDescribedBy("full_name", { error: errors.full_name })}
        />
      </FormField>
      <FormField id="phone" label="Phone number" hint="Used to pre-fill inspection requests." error={errors.phone} optionalLabel>
        <PhoneInput
          id="phone"
          name="phone"
          country={country}
          onCountryChange={setCountry}
          value={phoneValue}
          onValueChange={setPhoneValue}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={fieldDescribedBy("phone", { hint: true, error: errors.phone })}
        />
      </FormField>
      <input type="hidden" name="phone_country" value={country} />
      <Button type="submit" loading={pending} className="self-start">
        Save profile
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, { status: "idle" } as CustomerFormState);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <FormField
        id="confirm"
        label="Type DELETE to confirm"
        hint="Your profile and saved properties are deleted permanently. Inspection requests you sent stay with us as records of your enquiry but are no longer linked to an account."
        error={state.fieldErrors?.confirm}
      >
        <Input id="confirm" name="confirm" autoComplete="off" aria-describedby={fieldDescribedBy("confirm", { hint: true, error: state.fieldErrors?.confirm })} />
      </FormField>
      <Button type="submit" variant="danger" loading={pending} className="self-start">
        Delete my account
      </Button>
    </form>
  );
}
