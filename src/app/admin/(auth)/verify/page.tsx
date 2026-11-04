import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthHeading } from "@/components/admin/auth-heading";
import { Skeleton } from "@/components/ui/states";
import { getAdminSession } from "@/features/auth/admin-session";
import { ADMIN_LOGIN_PATH, OTP_TTL_SECONDS } from "@/features/auth/constants";
import { safeAdminPath } from "@/features/auth/redirects";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Enter your code" };

export default function AdminVerifyPage({ searchParams }: PageProps<"/admin/verify">) {
  return (
    <>
      <AuthHeading
        title="Check your email"
        description={`We sent a 6-digit code to your email address. It expires in ${OTP_TTL_SECONDS / 60} minutes.`}
      />
      <Suspense fallback={<Skeleton className="h-48" />}>
        <VerifyGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function VerifyGate({ searchParams }: { searchParams: PageProps<"/admin/verify">["searchParams"] }) {
  const params = await searchParams;
  const next = safeAdminPath(typeof params.next === "string" ? params.next : undefined);
  const session = await getAdminSession();

  if (session.status === "verified") redirect(next);
  if (session.status !== "pending_otp") redirect(`${ADMIN_LOGIN_PATH}?reason=expired`);

  return <VerifyForm next={next} sendFailed={params.notice === "send_failed"} />;
}
