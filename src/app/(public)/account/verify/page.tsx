import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountAuthCard, AuthFormFallback } from "@/components/public/account-auth-card";
import { ConfirmLinkForm } from "@/components/public/account-forms";
import { Notice } from "@/components/ui/notice";
import { TOKEN_HASH } from "@/features/customers/auth-schemas";
import { carriedParams, firstParam } from "@/features/customers/redirects";

export const metadata: Metadata = {
  title: "Activate your account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VerifyPage({ searchParams }: PageProps<"/account/verify">) {
  return (
    <AccountAuthCard title="Activate your account" intro="Confirm your email address to finish creating your account.">
      <Suspense fallback={<AuthFormFallback />}>
        <VerifyBody searchParams={searchParams} />
      </Suspense>
    </AccountAuthCard>
  );
}

async function VerifyBody({ searchParams }: { searchParams: PageProps<"/account/verify">["searchParams"] }) {
  const params = await searchParams;
  const token = firstParam(params, "token_hash");
  if (!TOKEN_HASH.test(token)) {
    return (
      <Notice tone="error">
        This link is incomplete or invalid. Open the link from your email again, or{" "}
        <Link href="/account/login" className="underline underline-offset-4">
          sign in to request a new one
        </Link>
        .
      </Notice>
    );
  }
  const { next, favourite } = carriedParams(params);
  return <ConfirmLinkForm token={token} purpose="verify" next={next} favourite={favourite} />;
}
