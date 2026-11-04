"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { logoutAction, resendOtpAction, verifyOtpAction } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/schemas";

export function VerifyForm({ next, sendFailed }: { next: string; sendFailed: boolean }) {
  const [state, verify, verifying] = useActionState(verifyOtpAction, initialAuthFormState);
  const [resendState, resend, resending] = useActionState(resendOtpAction, initialAuthFormState);
  const error = state.fieldErrors?.code;

  // Show the most relevant message: a resend result replaces a stale verification message.
  const message = resendState.message
    ? { tone: resendState.status === "success" ? ("success" as const) : ("error" as const), text: resendState.message }
    : state.message
      ? { tone: "error" as const, text: state.message }
      : sendFailed
        ? { tone: "error" as const, text: "We could not send the email. Use “Send a new code” in a minute." }
        : null;

  return (
    <div className="flex flex-col gap-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <form action={verify} className="flex flex-col gap-6" noValidate>
        <input type="hidden" name="next" value={next} />
        <FormField id="code" label="Sign-in code" error={error}>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            required
            autoFocus
            className="font-mono text-h4 tracking-[0.4em]"
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldDescribedBy("code", { error })}
          />
        </FormField>
        <Button type="submit" loading={verifying} className="w-full">
          Verify and continue
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <form action={resend}>
          <Button type="submit" variant="link" loading={resending}>
            Send a new code
          </Button>
        </form>
        <form action={logoutAction}>
          <Button type="submit" variant="link">
            Use a different account
          </Button>
        </form>
      </div>
    </div>
  );
}
