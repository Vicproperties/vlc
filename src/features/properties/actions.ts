"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { type PropertyKind, type PropertyStatus, PROPERTY_KINDS, PROPERTY_STATUSES } from "./options";
import { toPropertyRow } from "./row";
import { LISTINGS_TAG } from "@/features/listings/tags";
import { parsePropertyInput, publishProblems } from "./schemas";

export interface PropertyFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed values so the form keeps what was typed after a failed save. */
  values?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value.slice(0, 100_000);
  }
  return values;
}

function assertId(id: string) {
  if (!UUID.test(id)) throw new Error("Invalid property id.");
}

export async function createPropertyAction(
  kind: PropertyKind,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  if (!PROPERTY_KINDS.includes(kind)) throw new Error("Invalid property kind.");
  await requireAdminPermission("properties", "create");
  const values = formValues(formData);
  const parsed = parsePropertyInput(kind, values);
  if (!parsed.ok)
    return { status: "error", fieldErrors: parsed.fieldErrors, values, message: "Check the highlighted fields." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...toPropertyRow(parsed.data), status: "draft" })
    .select("id")
    .single();
  if (error) return { status: "error", message: dbErrorMessage(error), values };

  redirect(`/admin/properties/${data.id}?created=1`);
}

export async function updatePropertyAction(
  id: string,
  kind: PropertyKind,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  assertId(id);
  await requireAdminPermission("properties", "edit");
  const values = formValues(formData);
  const parsed = parsePropertyInput(kind, values);
  if (!parsed.ok)
    return { status: "error", fieldErrors: parsed.fieldErrors, values, message: "Check the highlighted fields." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update(toPropertyRow(parsed.data))
    .eq("id", id)
    .eq("kind", kind)
    .select("id, duplicate_state")
    .maybeSingle();
  if (error) return { status: "error", message: dbErrorMessage(error), values };
  if (!data) return { status: "error", message: "This property no longer exists, or you cannot edit it.", values };

  await supabase.rpc("log_activity", { p_action: "property.updated", p_entity_type: "property", p_entity_id: id });
  refresh();
  updateTag(LISTINGS_TAG);
  return {
    status: "success",
    message:
      data.duplicate_state === "flagged"
        ? "Saved. This property looks like a possible duplicate and needs review before publishing."
        : "Changes saved.",
  };
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function changePropertyStatusAction(id: string, next: PropertyStatus): Promise<ActionResult> {
  assertId(id);
  if (!PROPERTY_STATUSES.includes(next)) throw new Error("Invalid status.");
  await requireAdminPermission("properties", "view");

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("properties")
    .select(
      "status, regular_price, sales_price, state, location_text, city, description, duplicate_state, images:property_images(count)",
    )
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) return { ok: false, message: "This property could not be found." };

  // Moving into or out of "published" needs the publish permission (the database enforces
  // the same rule); other changes need edit.
  const touchesPublished = next === "published" || current.status === "published";
  await requireAdminPermission("properties", touchesPublished ? "publish" : "edit");

  if (next === "published") {
    if (current.duplicate_state === "flagged") {
      return { ok: false, message: "Review the possible duplicate before publishing." };
    }
    const imageCount = (current.images as unknown as Array<{ count: number }>)[0]?.count ?? 0;
    const problems = publishProblems({ ...current, imageCount });
    if (problems.length) return { ok: false, message: `Before publishing: ${problems.join(" ")}` };
  }

  const { error } = await supabase.from("properties").update({ status: next }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  updateTag(LISTINGS_TAG);
  return { ok: true, message: `Status changed to ${next}.` };
}

/** A publisher confirms a flagged property is not a duplicate. */
export async function clearDuplicateAction(id: string): Promise<ActionResult> {
  assertId(id);
  await requireAdminPermission("properties", "publish");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update({ duplicate_state: "cleared" })
    .eq("id", id)
    .eq("duplicate_state", "flagged")
    .select("duplicate_state")
    .maybeSingle();
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (data?.duplicate_state !== "cleared")
    return { ok: false, message: "This property is not awaiting duplicate review." };
  await supabase.rpc("log_activity", {
    p_action: "property.duplicate_cleared",
    p_entity_type: "property",
    p_entity_id: id,
  });
  refresh();
  updateTag(LISTINGS_TAG);
  return { ok: true, message: "Marked as not a duplicate. It can now be published." };
}

export async function deletePropertyAction(id: string): Promise<ActionResult> {
  assertId(id);
  await requireAdminPermission("properties", "delete");
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("title, images:property_images(storage_path)")
    .eq("id", id)
    .maybeSingle();
  if (!property) return { ok: false, message: "This property could not be found." };

  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };

  const paths = property.images.map((image) => image.storage_path);
  if (paths.length) await supabase.storage.from("property-media").remove(paths);
  await supabase.rpc("log_activity", {
    p_action: "property.deleted",
    p_entity_type: "property",
    p_entity_id: id,
    p_metadata: { title: property.title, photos_removed: paths.length },
  });
  updateTag(LISTINGS_TAG);
  redirect("/admin/properties?deleted=1");
}
