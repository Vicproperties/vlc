import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileForm } from "@/components/public/account-forms";
import { AccountShell } from "@/components/public/account-shell";
import { Skeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "My profile", robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountFallback />}>
      <AccountShell current="/account" title="My profile">
        {(customer) => (
          <ProfileForm fullName={customer.profile.full_name ?? ""} phone={customer.profile.phone ?? ""} />
        )}
      </AccountShell>
    </Suspense>
  );
}

function AccountFallback() {
  return (
    <div className="container-content flex flex-col gap-6 py-16">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40" />
    </div>
  );
}
