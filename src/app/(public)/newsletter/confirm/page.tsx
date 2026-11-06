import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountAuthCard, AuthFormFallback } from "@/components/public/account-auth-card";
import { NewsletterLinkButton } from "@/components/public/marketing";
import { Notice } from "@/components/ui/notice";
import { firstParam } from "@/features/customers/redirects";
import { confirmSubscriptionAction } from "@/features/newsletter/actions";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function NewsletterConfirmPage({ searchParams }: PageProps<"/newsletter/confirm">) {
  return (
    <AccountAuthCard
      title="Confirm your subscription"
      intro="One click and you will start receiving property news and offers."
    >
      <Suspense fallback={<AuthFormFallback />}>
        <ConfirmBody searchParams={searchParams} />
      </Suspense>
    </AccountAuthCard>
  );
}

async function ConfirmBody({ searchParams }: { searchParams: PageProps<"/newsletter/confirm">["searchParams"] }) {
  const token = firstParam(await searchParams, "token");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return <Notice tone="error">This link is incomplete. Open the link from your email again.</Notice>;
  }
  return <NewsletterLinkButton run={confirmSubscriptionAction.bind(null, token)} label="Confirm subscription" />;
}
