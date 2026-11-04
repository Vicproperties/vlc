"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice, type NoticeTone } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAction } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/schemas";

const reasons: Record<string, { tone: NoticeTone; text: string }> = {
  expired: { tone: "info", text: "Your session has ended. Sign in again to continue." },
  locked: { tone: "error", text: "Too many incorrect codes. Sign in again to receive a new code." },
  signed_out: { tone: "success", text: "You have signed out." },
  password_updated: { tone: "success", text: "Your password has been updated. Sign in with your new password." },
};

export function LoginForm() {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState(loginAction, initialAuthFormState);
  const reason = reasons[params.get("reason") ?? ""];
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message ? (
        <Notice tone="error">{state.message}</Notice>
      ) : (
        reason && <Notice tone={reason.tone}>{reason.text}</Notice>
      )}

      <input type="hidden" name="next" value={params.get("next") ?? ""} />

      <FormField id="email" label="Email address" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={fieldDescribedBy("email", { error: errors.email })}
        />
      </FormField>

      <FormField id="password" label="Password" error={errors.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={fieldDescribedBy("password", { error: errors.password })}
        />
      </FormField>

      <div className="flex flex-col gap-4">
        <Button type="submit" loading={pending} className="w-full">
          Continue
        </Button>
        <Link
          href="/admin/forgot-password"
          className="self-start text-small text-brand underline underline-offset-4 hover:text-brand-deep"
        >
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}
