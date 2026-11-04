"use server";

import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { PROPERTY_KINDS, type PropertyKind } from "../options";
import { toPropertyRow } from "../row";
import { parsePropertyInput, type RawInput } from "../schemas";
import { MAX_IMPORT_BYTES, parseImportCsv } from "./csv";

export interface ImportFormState {
  status: "idle" | "error";
  message?: string;
  details?: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Step 1: upload -> validate -> store the preview. The file itself is never stored: it is
 * read in memory, and only the parsed rows are kept (import_rows) for the preview step.
 */
export async function validateImportAction(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  await requireAdminPermission("properties", "create");

  const kind = PROPERTY_KINDS.find((k) => k === formData.get("kind"));
  if (!kind) return { status: "error", message: "Choose whether the file contains land or buildings." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a CSV file to upload." };
  if (file.size > MAX_IMPORT_BYTES)
    return { status: "error", message: "The file is larger than 2 MB. Split it into smaller files." };
  if (!/\.csv$/i.test(file.name))
    return { status: "error", message: "Upload a .csv file (in Excel: File > Save As > CSV UTF-8)." };

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return { status: "error", message: "The file is not UTF-8 text. In Excel choose “CSV UTF-8” when saving." };
  }

  const supabase = await createClient();
  const [estates, types] = await Promise.all([
    supabase.from("estates").select("id, name").eq("is_active", true),
    supabase.from("building_types").select("id, name, slug").eq("is_active", true),
  ]);
  const lookups = {
    estates: new Map((estates.data ?? []).map((e) => [e.name.toLowerCase(), e.id])),
    buildingTypes: new Map(
      (types.data ?? []).flatMap((t) => [[t.name.toLowerCase(), t.id] as const, [t.slug, t.id] as const]),
    ),
  };

  const parsed = parseImportCsv(text, kind, lookups);
  if (parsed.headerErrors.length) {
    return { status: "error", message: "The file could not be imported.", details: parsed.headerErrors };
  }

  // Likely duplicates of existing properties, checked in one database call.
  const candidates = parsed.rows.map((row) => ({
    title: row.raw.title ?? "",
    location_text: row.raw.location ?? "",
    land_size: row.input?.land_size?.toString() ?? "",
    land_size_unit: row.input?.land_size_unit ?? "",
  }));
  const { data: matches, error: dupError } = await supabase.rpc("find_property_duplicates", {
    p_kind: kind,
    p_rows: candidates as unknown as Json,
  });
  if (dupError) return { status: "error", message: dbErrorMessage(dupError) };
  const duplicateByIndex = new Map((matches ?? []).map((m) => [m.idx - 1, m.id]));

  const valid = parsed.rows.filter((row) => row.errors.length === 0).length;
  const duplicateCount = parsed.rows.filter((row, i) => duplicateByIndex.has(i) || row.sameFileAs !== null).length;

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      kind,
      file_name: file.name.slice(0, 255),
      row_count: parsed.rows.length,
      valid_count: valid,
      error_count: parsed.rows.length - valid,
      duplicate_count: duplicateCount,
    })
    .select("id")
    .single();
  if (jobError) return { status: "error", message: dbErrorMessage(jobError) };

  const rows = parsed.rows.map((row, i) => ({
    job_id: job.id,
    row_number: row.rowNumber,
    raw: row.raw as unknown as Json,
    normalized: (row.input ? { ...row.input } : null) as unknown as Json,
    errors: [
      ...row.errors,
      ...(row.sameFileAs !== null ? [`warning: looks the same as row ${row.sameFileAs} in this file.`] : []),
    ] as unknown as Json,
    duplicate_candidate_id: duplicateByIndex.get(i) ?? null,
    estate_match_id: row.estateId,
  }));
  for (let start = 0; start < rows.length; start += 100) {
    const { error } = await supabase.from("import_rows").insert(rows.slice(start, start + 100));
    if (error) {
      await supabase.from("import_jobs").delete().eq("id", job.id);
      return { status: "error", message: dbErrorMessage(error) };
    }
  }

  redirect(`/admin/properties/import/${job.id}`);
}

/** Step 2: create drafts from the valid rows. Never publishes. */
export async function commitImportAction(jobId: string, formData: FormData): Promise<void> {
  if (!UUID.test(jobId)) throw new Error("Invalid import id.");
  const admin = await requireAdminPermission("properties", "create");
  const skipDuplicates = formData.get("skip_duplicates") === "on";

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("id, kind, status, uploaded_by")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.status !== "validated" || job.uploaded_by !== admin.id) {
    redirect(`/admin/properties/import/${jobId}?error=unavailable`);
  }

  const { data: rows } = await supabase
    .from("import_rows")
    .select("id, row_number, normalized, errors, duplicate_candidate_id")
    .eq("job_id", jobId)
    .order("row_number");

  const selected = (rows ?? []).filter((row) => {
    const errors = (row.errors as string[]) ?? [];
    const blocking = errors.filter((e) => !e.startsWith("warning:"));
    const warned = errors.length > blocking.length || row.duplicate_candidate_id !== null;
    return blocking.length === 0 && row.normalized !== null && !(skipDuplicates && warned);
  });

  // Re-validate the stored values: the preview is never trusted blindly.
  const inserts = selected.flatMap((row) => {
    const parsed = parsePropertyInput(job.kind as PropertyKind, stringify(row.normalized as Record<string, unknown>));
    return parsed.ok ? [{ rowId: row.id, values: { ...toPropertyRow(parsed.data), status: "draft" as const } }] : [];
  });

  let created = 0;
  for (let start = 0; start < inserts.length; start += 50) {
    const chunk = inserts.slice(start, start + 50);
    const { data, error } = await supabase
      .from("properties")
      .insert(chunk.map((c) => c.values))
      .select("id");
    if (error) redirect(`/admin/properties/import/${jobId}?error=insert&created=${created}`);
    created += data.length;
    await Promise.all(
      data.map((property, i) =>
        supabase.from("import_rows").update({ property_id: property.id }).eq("id", chunk[i].rowId),
      ),
    );
  }

  await supabase
    .from("import_jobs")
    .update({ status: "imported", completed_at: new Date().toISOString() })
    .eq("id", jobId);
  await supabase.rpc("log_activity", {
    p_action: "property.import_completed",
    p_entity_type: "import_job",
    p_entity_id: jobId,
    p_metadata: { kind: job.kind, created, skipped_duplicates: skipDuplicates },
  });
  redirect(`/admin/properties/import/${jobId}?created=${created}`);
}

export async function discardImportAction(jobId: string): Promise<void> {
  if (!UUID.test(jobId)) throw new Error("Invalid import id.");
  const admin = await requireAdminPermission("properties", "create");
  const supabase = await createClient();
  await supabase
    .from("import_jobs")
    .update({ status: "discarded", completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "validated")
    .eq("uploaded_by", admin.id);
  redirect("/admin/properties/import?discarded=1");
}

/** Stored normalised values back into the form's string representation. */
function stringify(values: Record<string, unknown>): RawInput {
  const out: RawInput = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    if (value === null || value === undefined) out[key] = "";
    else if (Array.isArray(value)) out[key] = value.join("\n");
    else if (typeof value === "boolean") out[key] = value ? "on" : "";
    else out[key] = String(value);
  }
  return out;
}
