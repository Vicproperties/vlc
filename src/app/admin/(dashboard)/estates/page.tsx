import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Map, Plus } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estates" };

export default function EstatesPage({ searchParams }: PageProps<"/admin/estates">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EstatesList searchParams={searchParams} />
    </Suspense>
  );
}

async function EstatesList({ searchParams }: { searchParams: PageProps<"/admin/estates">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "estates", "view")) return <NoAccess section="estates" />;
  const params = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estates")
    .select("id, name, location, is_active, properties(count)")
    .order("name");
  if (error) throw new Error("Unable to load estates.");

  return (
    <>
      <AdminPageHeader
        title="Estates"
        description="Internal groupings of properties. Estates are never shown on the website."
        actions={
          can(admin, "estates", "create") && (
            <ButtonLink href="/admin/estates/new" leadingIcon={<Plus className="size-4" aria-hidden="true" />}>
              Add estate
            </ButtonLink>
          )
        }
      />
      {params.deleted === "1" && <Notice tone="success">The estate was deleted.</Notice>}

      {data.length === 0 ? (
        <EmptyState icon={Map} title="No estates yet" description="Add an estate to group related properties." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Location</TH>
              <TH>Properties</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((estate) => (
              <TR key={estate.id}>
                <TD>
                  <Link
                    href={`/admin/estates/${estate.id}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {estate.name}
                  </Link>
                </TD>
                <TD>{estate.location ?? <span className="text-stone">Not set</span>}</TD>
                <TD>{(estate.properties as unknown as Array<{ count: number }>)[0]?.count ?? 0}</TD>
                <TD>
                  <StatusText tone={estate.is_active ? "success" : "neutral"}>
                    {estate.is_active ? "Active" : "Inactive"}
                  </StatusText>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
