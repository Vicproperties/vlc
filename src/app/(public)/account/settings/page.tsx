import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm, DeleteAccountForm, SignOutButton } from "@/components/public/account-forms";
import { AccountShell } from "@/components/public/account-shell";
import { Skeleton } from "@/components/ui/states";

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
            <section className="flex flex-col gap-4" aria-labelledby="password-heading">
              <h2 id="password-heading" className="text-h3">
                Password
              </h2>
              <p className="text-small text-stone">
                Signed in as {customer.email}. Changing your password signs out your other devices.
              </p>
              <ChangePasswordForm />
            </section>
            <section className="flex flex-col gap-3 border-t border-line pt-10" aria-labelledby="signout-heading">
              <h2 id="signout-heading" className="text-h3">
                Sign out
              </h2>
              <SignOutButton variant="secondary" />
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
