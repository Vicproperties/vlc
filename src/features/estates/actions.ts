"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

/** Estates are internal groupings only; they are never shown on the public website. */
export interface EstateFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const estateSchema = z.object({
  name: z.string().trim().min(2, "Enter a name of at least 2 characters.").max(150, "Use 150 characters or fewer."),
  location: z
    .string()
    .trim()
    .max(300, "Use 300 characters or fewer.")
    .transform((v) => v || null),
  description: z
    .string()
    .trim()
    .max(5000, "Use 5,000 characters or fewer.")
    .transform((v) => v || null),
});

function read(formData: FormData) {
  const values = {
    name: String(formData.get("name") ?? ""),
    location: String(formData.get("location") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
  return { values, parsed: estateSchema.safeParse(values) };
}

function errorsOf(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function nameTaken(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function createEstateAction(_prev: EstateFormState, formData: FormData): Promise<EstateFormState> {
  await requireAdminPermission("estates", "create");
  const { values, parsed } = read(formData);
  if (!parsed.success) return { status: "error", fieldErrors: errorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.from("estates").insert(parsed.data).select("id").single();
  if (nameTaken(error))
    return { status: "error", fieldErrors: { name: "An estate with this name already exists." }, values };
  if (error) return { status: "error", message: dbErrorMessage(error), values };

  await supabase.rpc("log_activity", { p_action: "estate.created", p_entity_type: "estate", p_entity_id: data.id });
  redirect(`/admin/estates/${data.id}?created=1`);
}

export async function updateEstateAction(
  id: string,
  _prev: EstateFormState,
  formData: FormData,
): Promise<EstateFormState> {
  if (!UUID.test(id)) throw new Error("Invalid estate id.");
  await requireAdminPermission("estates", "edit");
  const { values, parsed } = read(formData);
  if (!parsed.success) return { status: "error", fieldErrors: errorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.from("estates").update(parsed.data).eq("id", id);
  if (nameTaken(error))
    return { status: "error", fieldErrors: { name: "An estate with this name already exists." }, values };
  if (error) return { status: "error", message: dbErrorMessage(error), values };

  await supabase.rpc("log_activity", { p_action: "estate.updated", p_entity_type: "estate", p_entity_id: id });
  refresh();
  return { status: "success", message: "Estate saved." };
}

export async function setEstateActiveAction(id: string, active: boolean): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(id)) throw new Error("Invalid estate id.");
  await requireAdminPermission("estates", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("estates").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: active ? "estate.activated" : "estate.deactivated",
    p_entity_type: "estate",
    p_entity_id: id,
  });
  refresh();
  return {
    ok: true,
    message: active ? "Estate activated." : "Estate deactivated. It can no longer be chosen for new properties.",
  };
}

export async function deleteEstateAction(id: string): Promise<{ ok: boolean; message: string }> {
  if (!UUID.test(id)) throw new Error("Invalid estate id.");
  await requireAdminPermission("estates", "delete");
  const supabase = await createClient();

  const { count } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("estate_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, message: "This estate still has properties. Move them or deactivate the estate instead." };
  }
  const { error } = await supabase.from("estates").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", { p_action: "estate.deleted", p_entity_type: "estate", p_entity_id: id });
  redirect("/admin/estates?deleted=1");
}
