import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BuildingTypesManager } from "@/components/admin/building-types-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Building types" };

export default function BuildingTypesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BuildingTypes />
    </Suspense>
  );
}

async function BuildingTypes() {
  const admin = await requireAdmin();
  if (!can(admin, "properties", "edit")) return <NoAccess section="building types" />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("building_types")
    .select("id, name, is_active, properties(count)")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Unable to load building types.");

  return (
    <>
      <AdminPageHeader
        title="Building types"
        description={
          <>
            Types offered on the building form. Hidden types stay on existing properties.{" "}
            <Link href="/admin/properties" className="underline underline-offset-4">
              All properties
            </Link>
          </>
        }
      />
      <BuildingTypesManager
        types={data.map((type) => ({
          id: type.id,
          name: type.name,
          is_active: type.is_active,
          count: (type.properties as unknown as Array<{ count: number }>)[0]?.count ?? 0,
        }))}
      />
    </>
  );
}
