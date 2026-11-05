import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalPageAdmin } from "@/components/admin/legal-page-admin";
import { Skeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <LegalPageAdmin slug="privacy-policy" />
    </Suspense>
  );
}
