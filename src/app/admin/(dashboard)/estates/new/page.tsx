import type { Metadata } from "next";
import { Suspense } from "react";
import { EstateForm } from "@/components/admin/estate-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createEstateAction } from "@/features/estates/actions";

export const metadata: Metadata = { title: "Add estate" };

export default function NewEstatePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewEstate />
    </Suspense>
  );
}

async function NewEstate() {
  const admin = await requireAdmin();
  if (!can(admin, "estates", "create")) return <NoAccess section="adding estates" />;
  return (
    <>
      <AdminPageHeader title="Add estate" />
      <EstateForm action={createEstateAction} initial={{}} submitLabel="Save estate" />
    </>
  );
}
