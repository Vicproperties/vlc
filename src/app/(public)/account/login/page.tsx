import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountAuthCard, AuthFormFallback } from "@/components/public/account-auth-card";
import { LoginForm } from "@/components/public/account-forms";
import { Notice } from "@/components/ui/notice";
import { carriedParams, carriedQuery, firstParam } from "@/features/customers/redirects";
import { getCustomer } from "@/features/customers/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function CustomerLoginPage({ searchParams }: PageProps<"/account/login">) {
  return (
    <AccountAuthCard
      title="Sign in"
      intro="Save properties to your favourites and follow your inspection requests. An account is optional: you can browse and request inspections without one."
      footer={
        <Suspense fallback={null}>
          <RegisterLink searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<AuthFormFallback />}>
        <LoginBody searchParams={searchParams} />
      </Suspense>
    </AccountAuthCard>
  );
}

async function LoginBody({ searchParams }: { searchParams: PageProps<"/account/login">["searchParams"] }) {
  const params = await searchParams;
  const carried = carriedParams(params);
  const customer = await getCustomer();
  if (customer && !customer.isStaff && customer.profile) redirect(carried.next);

  const reason = firstParam(params, "reason");
  return (
    <div className="flex flex-col gap-5">
      {reason === "password_updated" && (
        <Notice tone="success">Your password has been changed. Sign in with the new password.</Notice>
      )}
      {carried.favourite && <Notice tone="info">Sign in to save this property to your favourites.</Notice>}
      <LoginForm next={carried.next} favourite={carried.favourite} />
    </div>
  );
}

async function RegisterLink({ searchParams }: { searchParams: PageProps<"/account/login">["searchParams"] }) {
  const query = carriedQuery(carriedParams(await searchParams));
  return (
    <p>
      New here?{" "}
      <Link href={`/account/register${query}`} className="font-medium text-brand underline underline-offset-4">
        Create an account
      </Link>
    </p>
  );
}
