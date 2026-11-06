import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountAuthCard, AuthFormFallback } from "@/components/public/account-auth-card";
import { ConfirmLinkForm, NewPasswordForm } from "@/components/public/account-forms";
import { Notice } from "@/components/ui/notice";
import { getAuthClaims } from "@/features/auth/admin-session";
import { TOKEN_HASH } from "@/features/customers/auth-schemas";
import { hasResetMarker } from "@/features/customers/auth-server";
import { firstParam } from "@/features/customers/redirects";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage({ searchParams }: PageProps<"/account/reset-password">) {
  return (
    <AccountAuthCard title="Choose a new password">
      <Suspense fallback={<AuthFormFallback />}>
        <ResetBody searchParams={searchParams} />
      </Suspense>
    </AccountAuthCard>
  );
}

/**
 * Two steps: the emailed link opens this page with a token (one click to use it, so email
 * scanners cannot), then the page shows the new-password form for that reset session only.
 */
async function ResetBody({ searchParams }: { searchParams: PageProps<"/account/reset-password">["searchParams"] }) {
  const token = firstParam(await searchParams, "token_hash");
  if (TOKEN_HASH.test(token)) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-small text-stone">Continue to choose a new password for your account.</p>
        <ConfirmLinkForm token={token} purpose="reset" next="/account" favourite={null} />
      </div>
    );
  }
  const claims = await getAuthClaims();
  if (claims && (await hasResetMarker(claims.sessionId))) return <NewPasswordForm />;
  return (
    <Notice tone="error">
      This link is invalid or has expired.{" "}
      <Link href="/account/forgot-password" className="underline underline-offset-4">
        Request a new link
      </Link>
      .
    </Notice>
  );
}
