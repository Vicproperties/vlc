import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarCheck } from "lucide-react";
import { EnquiryTabs } from "@/components/admin/enquiry-tabs";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import {
  ADMIN_PAGE_SIZE,
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUSES,
  listInspections,
  STATUS_TONES,
} from "@/features/enquiries/admin";
import { PREFERRED_TIME_LABELS, requestReference } from "@/features/enquiries/schemas";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Inspection requests" };

export default function InspectionsPage({ searchParams }: PageProps<"/admin/inspections">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Inspections searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Inspections({ searchParams }: { searchParams: PageProps<"/admin/inspections">["searchParams"] }) {
  const admin = await requireAdmin();
  const canMessages = can(admin, "enquiries", "view");
  if (!can(admin, "inspections", "view")) {
    if (canMessages) redirect("/admin/inspections/messages");
    return <NoAccess section="inspections and enquiries" />;
  }

  const params = await searchParams;
  const statusParam = one(params.status);
  const status =
    statusParam === "all" ? "all" : (INSPECTION_STATUSES.find((s) => s === statusParam) ?? ("open" as const));
  const q = one(params.q).slice(0, 60);
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(params.page), 10) || 1));
  const { rows, total } = await listInspections({ status, q, page });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (target: number) => {
    const query = new URLSearchParams();
    if (status !== "open") query.set("status", status);
    if (q) query.set("q", q);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `/admin/inspections?${text}` : "/admin/inspections";
  };

  return (
    <>
      <AdminPageHeader
        title="Inspections & enquiries"
        description={`${total} matching inspection request${total === 1 ? "" : "s"}.`}
      />
      <EnquiryTabs current="inspections" canInspections canMessages={canMessages} />
      {one(params.deleted) === "1" && <Notice tone="success">The request was deleted.</Notice>}

      <form method="get" role="search" className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="q" className="text-small font-medium text-ink">
            Search
          </label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Name or phone number" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-small font-medium text-ink">
            Status
          </label>
          <Select
            id="status"
            name="status"
            defaultValue={status === "open" ? "" : status}
            placeholder="Open (pending + confirmed)"
            options={[
              ...INSPECTION_STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS_LABELS[s] })),
              { value: "all", label: "All statuses" },
            ]}
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={q || status !== "open" ? "No requests match" : "No open inspection requests"}
          description="Requests sent from property pages appear here."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Received</TH>
              <TH>Name</TH>
              <TH>Property</TH>
              <TH>Preferred</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => {
              const snapshot = row.property_snapshot as { title?: string };
              return (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap text-stone">{formatDate(row.created_at)}</TD>
                  <TD>
                    <Link
                      href={`/admin/inspections/${row.id}`}
                      className="font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {row.full_name}
                    </Link>
                    <span className="block font-mono text-caption text-stone">{requestReference(row.id)}</span>
                  </TD>
                  <TD>{snapshot.title ?? "Property removed"}</TD>
                  <TD className="whitespace-nowrap">
                    {row.preferred_date ? formatDate(row.preferred_date) : <span className="text-stone">Any day</span>}
                    {row.preferred_time && (
                      <span className="block text-caption text-stone">
                        {PREFERRED_TIME_LABELS[row.preferred_time as keyof typeof PREFERRED_TIME_LABELS] ??
                          row.preferred_time}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <StatusText tone={STATUS_TONES[row.status]}>{INSPECTION_STATUS_LABELS[row.status]}</StatusText>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
      <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} hrefFor={href} />
    </>
  );
}
