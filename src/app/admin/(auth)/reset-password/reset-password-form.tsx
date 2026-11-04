"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordAction } from "@/features/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/constants";
import { initialAuthFormState } from "@/features/auth/schemas";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialAuthFormState);
  const errors = state.fieldErrors ?? {};
  const hint = `At least ${PASSWORD_MIN_LENGTH} characters.`;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <FormField id="password" label="New password" hint={hint} error={errors.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={fieldDescribedBy("password", { hint, error: errors.password })}
        />
      </FormField>
      <FormField id="confirm" label="Confirm new password" error={errors.confirm}>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={fieldDescribedBy("confirm", { error: errors.confirm })}
        />
      </FormField>
      <Button type="submit" loading={pending} className="w-full">
        Save password
      </Button>
    </form>
  );
}
