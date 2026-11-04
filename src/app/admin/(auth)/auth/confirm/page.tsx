import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/admin/auth-heading";
import { Skeleton } from "@/components/ui/states";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm password link" };

/**
 * Landing page for emailed password links. The token is only used when the person presses
 * the button (a POST), so automated link scanners in email clients cannot consume it.
 */
export default function ConfirmPasswordLinkPage() {
  return (
    <>
      <AuthHeading title="Choose a new password" description="Continue to set a new password for your account." />
      <Suspense fallback={<Skeleton className="h-24" />}>
        <ConfirmForm />
      </Suspense>
    </>
  );
}
