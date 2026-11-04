import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PropertyForm } from "@/components/admin/property-form";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createPropertyAction } from "@/features/properties/actions";
import { PROPERTY_KINDS } from "@/features/properties/options";
import { listBuildingTypeOptions, listEstateOptions } from "@/features/properties/queries";

export const metadata: Metadata = { title: "Add property" };

export default function NewPropertyOfKindPage({ params }: PageProps<"/admin/properties/new/[kind]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <NewPropertyForm params={params} />
    </Suspense>
  );
}

async function NewPropertyForm({ params }: { params: PageProps<"/admin/properties/new/[kind]">["params"] }) {
  const { kind: raw } = await params;
  const kind = PROPERTY_KINDS.find((k) => k === raw);
  if (!kind) notFound();

  const admin = await requireAdmin();
  if (!can(admin, "properties", "create")) return <NoAccess section="adding properties" />;

  const [estates, buildingTypes] = await Promise.all([listEstateOptions(), listBuildingTypeOptions()]);

  return (
    <>
      <AdminPageHeader
        title={kind === "land" ? "Add land" : "Add building"}
        description="Saved as a draft. You can add photos and publish after saving."
      />
      <PropertyForm
        kind={kind}
        action={createPropertyAction.bind(null, kind)}
        initial={{ purpose: "sale" }}
        estates={estates.filter((e) => e.is_active).map((e) => ({ value: e.id, label: e.name }))}
        buildingTypes={buildingTypes.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }))}
        submitLabel="Save draft"
      />
    </>
  );
}
