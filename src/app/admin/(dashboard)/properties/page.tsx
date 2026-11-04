import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, Plus, Upload } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ButtonLink, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, Skeleton, StatusText, type StatusTone } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import {
  PROPERTY_KINDS,
  PROPERTY_STATUSES,
  PURPOSE_LABELS,
  STATUS_LABELS,
  type PropertyStatus,
} from "@/features/properties/options";
import { listProperties, PAGE_SIZE } from "@/features/properties/queries";
import { formatDate, formatNaira, formatPricePeriod } from "@/lib/format";

export const metadata: Metadata = { title: "Properties" };

const STATUS_TONES: Record<PropertyStatus, StatusTone> = {
  draft: "neutral",
  published: "success",
  unavailable: "warning",
  archived: "neutral",
};

export default function PropertiesPage({ searchParams }: PageProps<"/admin/properties">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PropertiesList searchParams={searchParams} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function PropertiesList({ searchParams }: { searchParams: PageProps<"/admin/properties">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "properties", "view")) return <NoAccess section="properties" />;

  const params = await searchParams;
  const status = PROPERTY_STATUSES.find((s) => s === one(params.status));
  const kind = PROPERTY_KINDS.find((k) => k === one(params.kind));
  const q = one(params.q).trim().slice(0, 100);
  const duplicates = one(params.review) === "duplicates";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one(params.page), 10) || 1));

  const { rows, total } = await listProperties({ status, kind, q: q || undefined, duplicates, page });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (kind) query.set("kind", kind);
    if (q) query.set("q", q);
    if (duplicates) query.set("review", "duplicates");
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `/admin/properties?${text}` : "/admin/properties";
  };
  const filtered = Boolean(status || kind || q || duplicates);

  return (
    <>
      <AdminPageHeader
        title="Properties"
        description={`${total} ${total === 1 ? "property" : "properties"}${filtered ? " match these filters" : ""}.`}
        actions={
          <>
            {can(admin, "properties", "create") && (
              <ButtonLink
                href="/admin/properties/import"
                variant="secondary"
                leadingIcon={<Upload className="size-4" aria-hidden="true" />}
              >
                Bulk import
              </ButtonLink>
            )}
            {can(admin, "properties", "create") && (
              <ButtonLink href="/admin/properties/new" leadingIcon={<Plus className="size-4" aria-hidden="true" />}>
                Add property
              </ButtonLink>
            )}
          </>
        }
      />

      {one(params.deleted) === "1" && <Notice tone="success">The property was deleted.</Notice>}

      <form method="get" className="grid gap-4 sm:grid-cols-[1fr_11rem_11rem_auto] sm:items-end" role="search">
        <div className="flex flex-col gap-2">
          <label htmlFor="q" className="text-small font-medium text-ink">
            Search
          </label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Title or location" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-small font-medium text-ink">
            Status
          </label>
          <Select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            placeholder="All statuses"
            options={PROPERTY_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="kind" className="text-small font-medium text-ink">
            Type
          </label>
          <Select
            id="kind"
            name="kind"
            defaultValue={kind ?? ""}
            placeholder="Land and buildings"
            options={[
              { value: "land", label: "Land" },
              { value: "building", label: "Buildings" },
            ]}
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-small">
        <Link href="/admin/properties?review=duplicates" className="text-brand underline underline-offset-4">
          Needs duplicate review
        </Link>
        {can(admin, "properties", "edit") && (
          <Link href="/admin/properties/building-types" className="text-brand underline underline-offset-4">
            Building types
          </Link>
        )}
        {filtered && (
          <Link href="/admin/properties" className="text-stone underline underline-offset-4">
            Clear filters
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? "No properties match these filters" : "No properties yet"}
          description={
            filtered ? "Try other filters or clear them." : "Add a property or import several from a spreadsheet."
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Type</TH>
              <TH>Location</TH>
              <TH>Price</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/admin/properties/${row.id}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {row.title}
                  </Link>
                  {row.duplicate_state === "flagged" && (
                    <span className="mt-1 block text-caption text-danger">Possible duplicate — review needed</span>
                  )}
                  {row.estate?.name && <span className="mt-1 block text-caption text-stone">{row.estate.name}</span>}
                </TD>
                <TD>
                  {row.kind === "land" ? "Land" : "Building"}
                  {row.purpose && <span className="block text-caption text-stone">{PURPOSE_LABELS[row.purpose]}</span>}
                </TD>
                <TD>
                  {[row.city, row.state].filter(Boolean).join(", ") || <span className="text-stone">Not set</span>}
                </TD>
                <TD className="whitespace-nowrap">
                  {row.effective_price ? (
                    <>
                      {formatNaira(row.effective_price)}
                      {row.price_period && <span className="text-stone"> {formatPricePeriod(row.price_period)}</span>}
                    </>
                  ) : (
                    <span className="text-stone">Not set</span>
                  )}
                </TD>
                <TD>
                  <StatusText tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</StatusText>
                </TD>
                <TD className="whitespace-nowrap text-stone">{formatDate(row.updated_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} hrefFor={hrefFor} />
    </>
  );
}
