import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { templateCsv } from "@/features/properties/import/csv";
import { PROPERTY_KINDS } from "@/features/properties/options";

/** Downloads the empty CSV template (header row only) for land or buildings. */
export async function GET(_request: Request, { params }: RouteContext<"/admin/properties/import/template/[kind]">) {
  const { kind: raw } = await params;
  const kind = PROPERTY_KINDS.find((k) => k === raw);
  if (!kind) notFound();
  await requireAdminPermission("properties", "create");

  return new Response(templateCsv(kind), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-import-template.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
