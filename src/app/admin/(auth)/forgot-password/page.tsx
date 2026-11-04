import type { Metadata } from "next";
import { AuthHeading } from "@/components/admin/auth-heading";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function AdminForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter the email address of your dashboard account. We will send you a link to choose a new password."
      />
      <ForgotPasswordForm />
    </>
  );
}
