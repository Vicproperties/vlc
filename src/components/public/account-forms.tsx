"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  type CustomerFormState,
  deleteAccountAction,
  signOutCustomerAction,
  updateProfileAction,
} from "@/features/customers/actions";
import {
  changePasswordAction,
  confirmEmailAction,
  confirmResetLinkAction,
  customerForgotPasswordAction,
  customerLoginAction,
  customerResetPasswordAction,
  type LoginState,
  registerAction,
  resendVerificationAction,
} from "@/features/customers/auth-actions";
import { CUSTOMER_PASSWORD_MIN_LENGTH } from "@/features/customers/auth-schemas";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";
import { Turnstile } from "./turnstile";

const idle: CustomerFormState = { status: "idle" };
const PASSWORD_HINT = `At least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters.`;

export function SignOutButton({ variant = "secondary" }: { variant?: "secondary" | "link" }) {
  const [, formAction, pending] = useActionState(() => signOutCustomerAction(), undefined);
  return (
    <form action={formAction}>
      <Button type="submit" variant={variant} loading={pending}>
        Sign out
      </Button>
    </form>
  );
}

/** Counts submissions so the bot check widget is replaced (tokens are single use). */
function useCountedAction(action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>) {
  return useActionState(
    async (prev: CustomerFormState & { n?: number }, formData: FormData) => ({
      ...(await action(prev, formData)),
      n: (prev.n ?? 0) + 1,
    }),
    { ...idle, n: 0 },
  );
}

function Carry({ next, favourite }: { next: string; favourite: string | null }) {
  return (
    <>
      <input type="hidden" name="next" value={next} />
      {favourite && <input type="hidden" name="favourite" value={favourite} />}
    </>
  );
}

function CheckInbox({ email, purpose }: { email: string; purpose: "verify" | "reset" }) {
  return (
    <div className="flex flex-col gap-3" role="status">
      <h2 className="text-h3">Check your email</h2>
      <p className="text-small text-stone">
        {purpose === "verify"
          ? `If ${email || "that address"} can be used for a new account, we have sent a link to activate it. Open the email and select "Activate account".`
          : `If ${email || "that address"} belongs to a customer account, we have sent a link to reset the password.`}{" "}
        The link expires in 1 hour. Check your spam folder if it does not arrive within a few minutes.
      </p>
    </div>
  );
}

function EmailField({ error, defaultValue }: { error?: string; defaultValue?: string }) {
  return (
    <FormField id="email" label="Email address" error={error} required>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={defaultValue}
        maxLength={254}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy("email", { error })}
      />
    </FormField>
  );
}

function NewPasswordFields({ errors, newLabel = "Password" }: { errors: Record<string, string>; newLabel?: string }) {
  return (
    <>
      <FormField id="password" label={newLabel} hint={PASSWORD_HINT} error={errors.password} required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={CUSTOMER_PASSWORD_MIN_LENGTH}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={fieldDescribedBy("password", { hint: PASSWORD_HINT, error: errors.password })}
        />
      </FormField>
      <FormField id="confirm" label={`Confirm ${newLabel.toLowerCase()}`} error={errors.confirm} required>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={fieldDescribedBy("confirm", { error: errors.confirm })}
        />
      </FormField>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
export function LoginForm({ next, favourite }: { next: string; favourite: string | null }) {
  const [state, formAction, pending] = useActionState(customerLoginAction, idle as LoginState);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.message && <Notice tone="error">{state.message}</Notice>}
        <Carry next={next} favourite={favourite} />
        <EmailField error={errors.email} defaultValue={state.email} />
        <FormField id="password" label="Password" error={errors.password} required>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={fieldDescribedBy("password", { error: errors.password })}
          />
        </FormField>
        <Link href="/account/forgot-password" className="self-start text-small text-brand underline underline-offset-4">
          Forgot your password?
        </Link>
        <Button type="submit" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>
      {state.unverified && state.email && (
        <ResendVerificationForm email={state.email} next={next} favourite={favourite} />
      )}
    </div>
  );
}

function ResendVerificationForm({ email, next, favourite }: { email: string; next: string; favourite: string | null }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, idle);
  if (state.status === "success") return <CheckInbox email={email} purpose="verify" />;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <input type="hidden" name="email" value={email} />
      <Carry next={next} favourite={favourite} />
      <Button type="submit" variant="secondary" loading={pending}>
        Send a new activation link
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export function RegisterForm({ next, favourite }: { next: string; favourite: string | null }) {
  const [state, formAction, pending] = useCountedAction(registerAction);
  const [email, setEmail] = useState("");
  const errors = state.fieldErrors ?? {};
  if (state.status === "success") return <CheckInbox email={email} purpose="verify" />;
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <Carry next={next} favourite={favourite} />
      <FormField id="full_name" label="Full name" error={errors.full_name} required>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          maxLength={120}
          aria-invalid={errors.full_name ? true : undefined}
          aria-describedby={fieldDescribedBy("full_name", { error: errors.full_name })}
        />
      </FormField>
      <FormField id="email" label="Email address" error={errors.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={fieldDescribedBy("email", { error: errors.email })}
        />
      </FormField>
      <NewPasswordFields errors={errors} />
      <Turnstile key={state.n} action="register" />
      <Button type="submit" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Emailed links: a click is required before the token is used (link scanners).
// ---------------------------------------------------------------------------
export function ConfirmLinkForm({
  token,
  purpose,
  next,
  favourite,
}: {
  token: string;
  purpose: "verify" | "reset";
  next: string;
  favourite: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    purpose === "verify" ? confirmEmailAction : confirmResetLinkAction,
    idle,
  );
  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message && (
        <Notice tone="error">
          {state.message}{" "}
          <Link
            href={purpose === "verify" ? "/account/login" : "/account/forgot-password"}
            className="underline underline-offset-4"
          >
            {purpose === "verify" ? "Sign in to request a new link" : "Request a new link"}
          </Link>
        </Notice>
      )}
      <input type="hidden" name="token_hash" value={token} />
      <Carry next={next} favourite={favourite} />
      <Button type="submit" loading={pending} className="w-full">
        {purpose === "verify" ? "Activate account" : "Continue"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Forgot / reset / change password
// ---------------------------------------------------------------------------
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useCountedAction(customerForgotPasswordAction);
  const [email, setEmail] = useState("");
  if (state.status === "success") return <CheckInbox email={email} purpose="reset" />;
  const error = state.fieldErrors?.email;
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <FormField id="email" label="Email address" error={error} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy("email", { error })}
        />
      </FormField>
      <Turnstile key={state.n} action="forgot_password" />
      <Button type="submit" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(customerResetPasswordAction, idle);
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <NewPasswordFields errors={state.fieldErrors ?? {}} newLabel="New password" />
      <Button type="submit" loading={pending} className="w-full">
        Save new password
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, idle);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <FormField id="current" label="Current password" error={errors.current} required>
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          aria-invalid={errors.current ? true : undefined}
          aria-describedby={fieldDescribedBy("current", { error: errors.current })}
        />
      </FormField>
      <NewPasswordFields errors={errors} newLabel="New password" />
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        Change password
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Profile and account deletion
// ---------------------------------------------------------------------------
export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, idle);
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
      <FormField
        id="phone"
        label="Phone number"
        hint="Used to pre-fill inspection requests."
        error={errors.phone}
        optionalLabel
      >
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
  const [state, formAction, pending] = useActionState(deleteAccountAction, idle);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <FormField
        id="delete_confirm"
        label="Type DELETE to confirm"
        hint="Your profile and saved properties are deleted permanently. Inspection requests you sent stay with us as records of your enquiry but are no longer linked to an account."
        error={state.fieldErrors?.confirm}
      >
        <Input
          id="delete_confirm"
          name="confirm"
          autoComplete="off"
          aria-describedby={fieldDescribedBy("delete_confirm", { hint: true, error: state.fieldErrors?.confirm })}
        />
      </FormField>
      <Button type="submit" variant="danger" loading={pending} className="self-start">
        Delete my account
      </Button>
    </form>
  );
}
