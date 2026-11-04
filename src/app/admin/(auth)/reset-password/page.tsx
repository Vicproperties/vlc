import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/admin/auth-heading";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { getAuthClaims } from "@/features/auth/admin-session";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/constants";
import { createServiceClient } from "@/lib/supabase/service";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function AdminResetPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Choose a new password"
        description={`Use at least ${PASSWORD_MIN_LENGTH} characters. A short sentence you will remember works well.`}
      />
      <Suspense fallback={<Skeleton className="h-56" />}>
        <ResetGate />
      </Suspense>
    </>
  );
}

async function ResetGate() {
  const claims = await getAuthClaims();
  const { data: valid } = claims
    ? await createServiceClient().rpc("admin_recovery_is_valid", {
        p_session_id: claims.sessionId,
        p_admin_id: claims.userId,
      })
    : { data: false };

  if (valid !== true) {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="error">
          This password link is invalid or has expired. Links work once, for 15 minutes after opening.
        </Notice>
        <Link
          href="/admin/forgot-password"
          className="text-small text-brand underline underline-offset-4 hover:text-brand-deep"
        >
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm />;
}
