import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EstateControls } from "@/components/admin/estate-controls";
import { EstateForm } from "@/components/admin/estate-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui/notice";
import { Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { updateEstateAction } from "@/features/estates/actions";
import { STATUS_LABELS } from "@/features/properties/options";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estate" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EstatePage({ params, searchParams }: PageProps<"/admin/estates/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Estate params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Estate({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/estates/[id]">["params"];
  searchParams: PageProps<"/admin/estates/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const admin = await requireAdmin();
  if (!can(admin, "estates", "view")) return <NoAccess section="estates" />;

  const supabase = await createClient();
  const { data: estate } = await supabase
    .from("estates")
    .select("id, name, location, description, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!estate) notFound();

  const canSeeProperties = can(admin, "properties", "view");
  const { data: properties } = canSeeProperties
    ? await supabase.from("properties").select("id, title, status").eq("estate_id", id).order("title")
    : { data: [] };

  return (
    <>
      <AdminPageHeader
        title={estate.name}
        description={
          <>
            {estate.is_active ? "Active" : "Inactive"} ·{" "}
            <Link href="/admin/estates" className="underline underline-offset-4">
              All estates
            </Link>
          </>
        }
      />
      {query.created === "1" && <Notice tone="success">Estate saved.</Notice>}
      <EstateControls
        estateId={estate.id}
        isActive={estate.is_active}
        canEdit={can(admin, "estates", "edit")}
        canDelete={can(admin, "estates", "delete")}
      />

      {can(admin, "estates", "edit") && (
        <EstateForm
          key={`${estate.name}-${estate.location}-${estate.description}`}
          action={updateEstateAction.bind(null, estate.id)}
          initial={{ name: estate.name, location: estate.location ?? "", description: estate.description ?? "" }}
          submitLabel="Save changes"
        />
      )}

      {canSeeProperties && (
        <section className="flex flex-col gap-4 border-t border-line pt-8">
          <h2 className="text-body font-semibold text-ink">Properties in this estate</h2>
          {properties && properties.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {properties.map((property) => (
                  <TR key={property.id}>
                    <TD>
                      <Link
                        href={`/admin/properties/${property.id}`}
                        className="text-ink underline-offset-4 hover:underline"
                      >
                        {property.title}
                      </Link>
                    </TD>
                    <TD>
                      <StatusText>{STATUS_LABELS[property.status]}</StatusText>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-small text-stone">No properties are linked to this estate yet.</p>
          )}
        </section>
      )}
    </>
  );
}
