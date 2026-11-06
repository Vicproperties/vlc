import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { DEFAULT_SUB_ADMIN_PERMISSIONS } from "@/features/admins/permissions";
import { requireAdmin } from "@/features/auth/admin-session";

export const metadata: Metadata = { title: "Invite administrator" };

export default function InviteAdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <InviteAdmin />
    </Suspense>
  );
}

async function InviteAdmin() {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) return <NoAccess section="admin users" />;
  return (
    <>
      <Link href="/admin/admins" className="text-small text-stone underline-offset-4 hover:underline">
        Back to admin users
      </Link>
      <AdminPageHeader
        title="Invite administrator"
        description="They receive an email to set a password, then sign in with their password and an emailed code."
      />
      <AdminUserForm
        mode="invite"
        initial={{ fullName: "", email: "", role: "sub_admin", permissions: DEFAULT_SUB_ADMIN_PERMISSIONS }}
      />
    </>
  );
}
