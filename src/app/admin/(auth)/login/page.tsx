import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/admin/auth-heading";
import { Skeleton } from "@/components/ui/states";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <>
      <AuthHeading title="Sign in" description="Dashboard access for authorised staff." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
