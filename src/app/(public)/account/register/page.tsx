import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountAuthCard, AuthFormFallback } from "@/components/public/account-auth-card";
import { RegisterForm } from "@/components/public/account-forms";
import { carriedParams, carriedQuery } from "@/features/customers/redirects";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: false } };

export default function RegisterPage({ searchParams }: PageProps<"/account/register">) {
  return (
    <AccountAuthCard
      title="Create an account"
      intro="We will email you a link to confirm your address before the account is activated."
      footer={
        <div className="flex flex-col gap-3">
          <Suspense fallback={null}>
            <SignInLink searchParams={searchParams} />
          </Suspense>
          <p className="text-caption">
            By creating an account you agree to our{" "}
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
      }
    >
      <Suspense fallback={<AuthFormFallback />}>
        <RegisterBody searchParams={searchParams} />
      </Suspense>
    </AccountAuthCard>
  );
}

async function RegisterBody({ searchParams }: { searchParams: PageProps<"/account/register">["searchParams"] }) {
  const { next, favourite } = carriedParams(await searchParams);
  return <RegisterForm next={next} favourite={favourite} />;
}

async function SignInLink({ searchParams }: { searchParams: PageProps<"/account/register">["searchParams"] }) {
  const query = carriedQuery(carriedParams(await searchParams));
  return (
    <p>
      Already have an account?{" "}
      <Link href={`/account/login${query}`} className="font-medium text-brand underline underline-offset-4">
        Sign in
      </Link>
    </p>
  );
}
