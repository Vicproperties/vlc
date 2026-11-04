"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { confirmRecoveryAction } from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/schemas";

export function ConfirmForm() {
  const token = useSearchParams().get("token_hash") ?? "";
  const [state, formAction, pending] = useActionState(confirmRecoveryAction, initialAuthFormState);

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="error">This link is incomplete. Open the link from the email again, or request a new one.</Notice>
        <Link
          href="/admin/forgot-password"
          className="text-small text-brand underline underline-offset-4 hover:text-brand-deep"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.message && (
        <Notice tone="error">
          {state.message}{" "}
          <Link href="/admin/forgot-password" className="underline underline-offset-4">
            Request a new link
          </Link>
        </Notice>
      )}
      <input type="hidden" name="token_hash" value={token} />
      <Button type="submit" loading={pending} className="w-full">
        Continue
      </Button>
    </form>
  );
}
