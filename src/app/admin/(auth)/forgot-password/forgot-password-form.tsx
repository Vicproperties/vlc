"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { forgotPasswordAction } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/schemas";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialAuthFormState);
  const error = state.fieldErrors?.email;

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="success">{state.message}</Notice>
        <Link href="/admin/login" className="text-small text-brand underline underline-offset-4 hover:text-brand-deep">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <FormField id="email" label="Email address" error={error}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy("email", { error })}
        />
      </FormField>
      <div className="flex flex-col gap-4">
        <Button type="submit" loading={pending} className="w-full">
          Send reset link
        </Button>
        <Link
          href="/admin/login"
          className="self-start text-small text-brand underline underline-offset-4 hover:text-brand-deep"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
