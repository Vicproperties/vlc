import type { Metadata } from "next";
import Link from "next/link";
import { AccountAuthCard } from "@/components/public/account-auth-card";
import { ForgotPasswordForm } from "@/components/public/account-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AccountAuthCard
      title="Forgot your password?"
      intro="Enter the email address of your account and we will send you a link to choose a new password."
      footer={
        <Link href="/account/login" className="font-medium text-brand underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AccountAuthCard>
  );
}
