import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Notice } from "@/components/ui/notice";
import { Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { commitImportAction, discardImportAction } from "@/features/properties/import/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Import preview" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ImportPreviewPage({ params, searchParams }: PageProps<"/admin/properties/import/[jobId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Preview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/properties/import/[jobId]">["params"];
  searchParams: PageProps<"/admin/properties/import/[jobId]">["searchParams"];
}) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(jobId)) notFound();
  const admin = await requireAdmin();
  if (!can(admin, "properties", "create")) return <NoAccess section="importing properties" />;

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select(
      "id, kind, file_name, status, row_count, valid_count, error_count, duplicate_count, uploaded_by, created_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();

  const { data: rows } = await supabase
    .from("import_rows")
    .select(
      "row_number, raw, errors, duplicate_candidate_id, property_id, duplicate:properties!import_rows_duplicate_candidate_id_fkey(id, title)",
    )
    .eq("job_id", jobId)
    .order("row_number");

  const isOwner = job.uploaded_by === admin.id;
  const created = typeof query.created === "string" ? Number.parseInt(query.created, 10) : null;

  return (
    <>
      <AdminPageHeader
        title="Import preview"
        description={
          <>
            {job.file_name} · {job.kind === "land" ? "Land" : "Buildings"} ·{" "}
            <Link href="/admin/properties/import" className="underline underline-offset-4">
              New import
            </Link>
          </>
        }
      />

      {query.error === "unavailable" && <Notice tone="error">This import can no longer be confirmed.</Notice>}
      {query.error === "insert" && (
        <Notice tone="error">
          The import stopped part-way: {created ?? 0} draft(s) were created. Check the drafts list.
        </Notice>
      )}
      {job.status === "imported" && (
        <Notice tone="success">
          Import complete{created !== null && !query.error ? `: ${created} draft(s) created` : ""}.{" "}
          <Link href="/admin/properties?status=draft" className="underline underline-offset-4">
            View drafts
          </Link>
        </Notice>
      )}
      {job.status === "discarded" && <Notice tone="info">This import was discarded.</Notice>}

      <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {[
          ["Rows", job.row_count],
          ["Ready", job.valid_count],
          ["With errors", job.error_count],
          ["Possible duplicates", job.duplicate_count],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-paper p-4">
            <dt className="text-caption text-stone">{label}</dt>
            <dd className="text-h3 font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {job.status === "validated" && isOwner && (
        <form action={commitImportAction.bind(null, job.id)} className="flex flex-col gap-4 border border-line p-5">
          <Checkbox
            id="skip_duplicates"
            name="skip_duplicates"
            value="on"
            defaultChecked
            label="Skip rows that look like duplicates"
            description="Recommended. If unticked, they are imported but must be reviewed before publishing."
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={job.valid_count === 0}>
              Create drafts from ready rows
            </Button>
            <Button type="submit" variant="quiet" formAction={discardImportAction.bind(null, job.id)}>
              Discard import
            </Button>
          </div>
          <p className="text-caption text-stone">
            Rows with errors are never imported. Fix them in the file and import again.
          </p>
        </form>
      )}

      <Table>
        <THead>
          <TR>
            <TH>Row</TH>
            <TH>Title</TH>
            <TH>Result</TH>
          </TR>
        </THead>
        <TBody>
          {(rows ?? []).map((row) => {
            const errors = ((row.errors as string[]) ?? []).filter((e) => !e.startsWith("warning:"));
            const warnings = ((row.errors as string[]) ?? []).filter((e) => e.startsWith("warning:"));
            const raw = row.raw as Record<string, string>;
            return (
              <TR key={row.row_number}>
                <TD className="align-top">{row.row_number}</TD>
                <TD className="align-top">
                  {row.property_id ? (
                    <Link href={`/admin/properties/${row.property_id}`} className="underline underline-offset-4">
                      {raw.title || "(no title)"}
                    </Link>
                  ) : (
                    raw.title || <span className="text-stone">(no title)</span>
                  )}
                </TD>
                <TD className="align-top">
                  {errors.length ? (
                    <ul className="flex flex-col gap-1 text-small text-danger">
                      {errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : (
                    <StatusText tone="success">{row.property_id ? "Imported as draft" : "Ready"}</StatusText>
                  )}
                  {row.duplicate && (
                    <p className="mt-1 text-small text-warning">
                      Possible duplicate of{" "}
                      <Link href={`/admin/properties/${row.duplicate.id}`} className="underline underline-offset-4">
                        {row.duplicate.title}
                      </Link>
                    </p>
                  )}
                  {warnings.map((warning) => (
                    <p key={warning} className="mt-1 text-small text-warning">
                      {warning.replace(/^warning:\s*/, "")}
                    </p>
                  ))}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      {job.status !== "validated" && (
        <ButtonLink href="/admin/properties/import" variant="secondary" className="self-start">
          Start another import
        </ButtonLink>
      )}
    </>
  );
}
