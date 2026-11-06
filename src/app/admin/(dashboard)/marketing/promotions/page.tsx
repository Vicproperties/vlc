import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Tag } from "lucide-react";
import { PromotionToggle } from "@/components/admin/marketing-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { formatNaira } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Property promotions" };

export default function PromotionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Promotions />
    </Suspense>
  );
}

async function Promotions() {
  const admin = await requireAdmin();
  if (!can(admin, "marketing", "view")) return <NoAccess section="marketing" />;
  // Marketing staff may not have property access: read only these fields, server-side.
  const { data, error } = await createServiceClient()
    .from("properties")
    .select("id, title, status, regular_price, sales_price, promotion_active, discount_percent")
    .neq("status", "archived")
    .not("sales_price", "is", null)
    .not("regular_price", "is", null)
    .order("promotion_active", { ascending: false })
    .order("title");
  if (error) throw new Error("Unable to load properties.");
  const canEdit = can(admin, "marketing", "edit");
  const canOpen = can(admin, "properties", "view");

  return (
    <>
      <AdminPageHeader
        title="Property promotions"
        description="A promotion shows the regular price struck through, the sales price and the discount. Properties need both prices, with the sales price lower."
      />
      {data.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No properties can be promoted yet"
          description="Give a property both a regular price and a lower sales price to promote it."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>Regular price</TH>
              <TH>Sales price</TH>
              <TH>Promotion</TH>
              {canEdit && <TH>Action</TH>}
            </TR>
          </THead>
          <TBody>
            {data.map((p) => {
              const eligible = Number(p.sales_price) < Number(p.regular_price);
              return (
                <TR key={p.id}>
                  <TD>
                    {canOpen ? (
                      <Link
                        href={`/admin/properties/${p.id}`}
                        className="font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {p.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{p.title}</span>
                    )}
                    {p.status !== "published" && <p className="text-caption text-stone">Not published</p>}
                  </TD>
                  <TD>{formatNaira(Number(p.regular_price))}</TD>
                  <TD>
                    {formatNaira(Number(p.sales_price))}
                    {!eligible && <p className="text-caption text-stone">Not lower than the regular price</p>}
                  </TD>
                  <TD>
                    {p.promotion_active ? (
                      <StatusText tone="success">
                        On{p.discount_percent ? `, ${p.discount_percent}% off` : ""}
                      </StatusText>
                    ) : (
                      <StatusText tone="neutral">Off</StatusText>
                    )}
                  </TD>
                  {canEdit && (
                    <TD>
                      <PromotionToggle id={p.id} title={p.title} active={p.promotion_active} eligible={eligible} />
                    </TD>
                  )}
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
