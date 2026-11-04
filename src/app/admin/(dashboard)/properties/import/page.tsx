import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { ImportUploadForm } from "@/components/admin/import-upload-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";

export const metadata: Metadata = { title: "Bulk import" };

export default function ImportPage({ searchParams }: PageProps<"/admin/properties/import">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Import searchParams={searchParams} />
    </Suspense>
  );
}

async function Import({ searchParams }: { searchParams: PageProps<"/admin/properties/import">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "properties", "create")) return <NoAccess section="importing properties" />;
  const params = await searchParams;

  return (
    <>
      <AdminPageHeader
        title="Bulk import"
        description={
          <>
            Add many properties from a spreadsheet. Imported properties are saved as drafts.{" "}
            <Link href="/admin/properties" className="underline underline-offset-4">
              All properties
            </Link>
          </>
        }
      />
      {params.discarded === "1" && <Notice tone="info">The import was discarded. Nothing was added.</Notice>}

      <section className="flex flex-col gap-4">
        <h2 className="text-body font-semibold text-ink">1. Download a template</h2>
        <div className="flex flex-wrap gap-6 text-small">
          {(["land", "building"] as const).map((kind) => (
            <a
              key={kind}
              href={`/admin/properties/import/template/${kind}`}
              className="inline-flex items-center gap-2 text-brand underline underline-offset-4"
              download
            >
              <Download className="size-4" aria-hidden="true" />
              {kind === "land" ? "Land template" : "Building template"}
            </a>
          ))}
        </div>
        <ul className="flex max-w-3xl list-disc flex-col gap-1.5 pl-5 text-small text-stone">
          <li>
            Required: <strong className="text-ink">title</strong> and <strong className="text-ink">purpose</strong>{" "}
            (sale, rent or lease). Leave other columns empty if unknown.
          </li>
          <li>
            Prices in whole naira, e.g. 25000000. Payment period: per week, per month or per year (rent and lease only).
          </li>
          <li>State: a Nigerian state name, or FCT. Estate and building type must match existing names exactly.</li>
          <li>Land size unit: sqm, plot, acre or hectare. Features: separate with semicolons.</li>
          <li>Promotion active: yes or no. Cells must not start with =, + or @.</li>
          <li>Photos are added afterwards on each property.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="text-body font-semibold text-ink">2. Upload the completed file</h2>
        <ImportUploadForm />
      </section>
    </>
  );
}
