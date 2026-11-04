import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PropertyForm } from "@/components/admin/property-form";
import { PropertyImages } from "@/components/admin/property-images";
import { PropertyStatusControls } from "@/components/admin/property-status-controls";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { updatePropertyAction } from "@/features/properties/actions";
import { propertyToFormValues } from "@/features/properties/form-values";
import { propertyImageUrl } from "@/features/properties/media";
import { getPropertyForEdit, listBuildingTypeOptions, listEstateOptions } from "@/features/properties/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Edit property" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditPropertyPage({ params, searchParams }: PageProps<"/admin/properties/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <EditProperty params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditProperty({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/properties/[id]">["params"];
  searchParams: PageProps<"/admin/properties/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const admin = await requireAdmin();
  if (!can(admin, "properties", "view")) return <NoAccess section="properties" />;

  const [property, estates, buildingTypes] = await Promise.all([
    getPropertyForEdit(id),
    listEstateOptions(),
    listBuildingTypeOptions(),
  ]);
  if (!property) notFound();

  const canEdit = can(admin, "properties", "edit");
  // Keep the current choice selectable even if it was deactivated later.
  const estateOptions = estates
    .filter((e) => e.is_active || e.id === property.estate_id)
    .map((e) => ({ value: e.id, label: e.is_active ? e.name : `${e.name} (inactive)` }));
  const typeOptions = buildingTypes
    .filter((t) => t.is_active || t.id === property.building_type_id)
    .map((t) => ({ value: t.id, label: t.is_active ? t.name : `${t.name} (inactive)` }));

  const images = [...property.images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      id: image.id,
      url: propertyImageUrl(image.storage_path),
      alt: image.alt_text ?? "",
      isCover: image.is_cover,
      width: image.width,
      height: image.height,
    }));

  return (
    <>
      <AdminPageHeader
        title={property.title}
        description={
          <>
            {property.kind === "land" ? "Land" : "Building"} · last updated {formatDate(property.updated_at)} ·{" "}
            <Link href="/admin/properties" className="underline underline-offset-4">
              All properties
            </Link>
          </>
        }
      />

      {query.created === "1" && <Notice tone="success">Draft saved. Add photos, then publish when it is ready.</Notice>}

      <PropertyStatusControls
        propertyId={property.id}
        status={property.status}
        duplicate={property.duplicate_state === "flagged" && property.duplicate ? property.duplicate : null}
        canEdit={canEdit}
        canPublish={can(admin, "properties", "publish")}
        canDelete={can(admin, "properties", "delete")}
      />

      <section className="flex flex-col gap-4 border-t border-line pt-8" aria-labelledby="photos-heading">
        <h2 id="photos-heading" className="text-body font-semibold text-ink">
          Photos
        </h2>
        <PropertyImages propertyId={property.id} images={images} canEdit={canEdit} />
      </section>

      {canEdit ? (
        <PropertyForm
          key={property.updated_at}
          kind={property.kind}
          action={updatePropertyAction.bind(null, property.id, property.kind)}
          initial={propertyToFormValues(property)}
          estates={estateOptions}
          buildingTypes={typeOptions}
          submitLabel="Save changes"
        />
      ) : (
        <Notice tone="info">You can view this property but not edit it.</Notice>
      )}
    </>
  );
}
