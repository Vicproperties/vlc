import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/public/account-forms";
import { AccountShell } from "@/components/public/account-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { signOutCustomerAction } from "@/features/customers/actions";

export const metadata: Metadata = { title: "Account settings", robots: { index: false, follow: false } };

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container-content py-16">
          <Skeleton className="h-64" />
        </div>
      }
    >
      <AccountShell current="/account/settings" title="Account settings">
        {(customer) => (
          <div className="flex flex-col gap-12">
            <section className="flex flex-col gap-3" aria-labelledby="signin-heading">
              <h2 id="signin-heading" className="text-h3">
                Sign-in
              </h2>
              <p className="text-small text-stone">
                You sign in with Google{customer.email ? ` (${customer.email})` : ""}. We never see your Google
                password.
              </p>
              <form action={signOutCustomerAction}>
                <Button type="submit" variant="secondary">
                  Sign out
                </Button>
              </form>
            </section>
            <section className="flex flex-col gap-4 border-t border-line pt-10" aria-labelledby="delete-heading">
              <h2 id="delete-heading" className="text-h3">
                Delete account
              </h2>
              <DeleteAccountForm />
            </section>
          </div>
        )}
      </AccountShell>
    </Suspense>
  );
}
