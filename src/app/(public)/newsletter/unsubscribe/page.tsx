import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountAuthCard, AuthFormFallback } from "@/components/public/account-auth-card";
import { NewsletterLinkButton } from "@/components/public/marketing";
import { Notice } from "@/components/ui/notice";
import { firstParam } from "@/features/customers/redirects";
import { unsubscribeAction } from "@/features/newsletter/actions";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function NewsletterUnsubscribePage({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  return (
    <AccountAuthCard title="Unsubscribe" intro="Stop receiving the property news and offers email.">
      <Suspense fallback={<AuthFormFallback />}>
        <UnsubscribeBody searchParams={searchParams} />
      </Suspense>
    </AccountAuthCard>
  );
}

async function UnsubscribeBody({
  searchParams,
}: {
  searchParams: PageProps<"/newsletter/unsubscribe">["searchParams"];
}) {
  const params = await searchParams;
  const id = firstParam(params, "id");
  const sig = firstParam(params, "sig");
  if (!id || !sig) return <Notice tone="error">This link is incomplete. Open the link from your email again.</Notice>;
  return <NewsletterLinkButton run={unsubscribeAction.bind(null, id, sig)} label="Unsubscribe" />;
}
