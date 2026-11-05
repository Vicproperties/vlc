import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContentSections } from "@/components/admin/content-sections";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";

export const metadata: Metadata = { title: "Contact page content" };

export default function ContactContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ContactContent />
    </Suspense>
  );
}

async function ContactContent() {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  return (
    <>
      <AdminPageHeader
        title="Contact page"
        description={
          <>
            Phone numbers, email, address, opening hours and the map are set in{" "}
            <Link href="/admin/settings" className="underline underline-offset-4">
              Website Settings
            </Link>
            .
          </>
        }
      />
      <ContentSections page="contact" canEdit={can(admin, "content", "edit")} />
    </>
  );
}
