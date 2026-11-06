import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoogleSignInForm } from "@/components/public/account-forms";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { safeCustomerPath } from "@/features/customers/redirects";
import { getCustomer } from "@/features/customers/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function CustomerLoginPage({ searchParams }: PageProps<"/account/login">) {
  return (
    <div className="container-content flex justify-center py-16 md:py-24">
      <div className="flex w-full max-w-md flex-col gap-8 border border-line p-8 sm:p-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-h2 text-ink">Sign in</h1>
          <p className="text-small text-stone">
            Save properties to your favourites and follow your inspection requests from any device. An account is
            optional: you can browse and request inspections without one.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-11" />}>
          <LoginBody searchParams={searchParams} />
        </Suspense>
        <p className="text-caption text-stone">
          By continuing you agree to our{" "}
          <Link href="/terms-and-conditions" className="underline underline-offset-4">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

async function LoginBody({ searchParams }: { searchParams: PageProps<"/account/login">["searchParams"] }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const next = safeCustomerPath(one(params.next) || "/account");
  const favourite = /^[0-9a-f-]{36}$/i.test(one(params.favourite)) ? one(params.favourite) : null;

  const customer = await getCustomer();
  if (customer && !customer.isStaff && customer.profile) redirect(next);

  return (
    <div className="flex flex-col gap-4">
      {one(params.error) === "staff" && (
        <Notice tone="error">This is a staff account. Customer features use a separate personal Google account.</Notice>
      )}
      {one(params.error) === "sign_in" && <Notice tone="error">Sign-in did not complete. Please try again.</Notice>}
      {favourite && <Notice tone="info">Sign in to save this property to your favourites.</Notice>}
      <GoogleSignInForm next={next} favourite={favourite} />
    </div>
  );
}
