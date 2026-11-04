"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { slugify } from "@/lib/slug";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { LISTINGS_TAG } from "@/features/listings/tags";
import { createClient } from "@/lib/supabase/server";

export interface SimpleState {
  status: "idle" | "error" | "success";
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extends the approved building type list (owner decision: fixed list admins can extend). */
export async function createBuildingTypeAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  await requireAdminPermission("properties", "edit");
  const name = String(formData.get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || name.length > 80) return { status: "error", message: "Enter a name of 2 to 80 characters." };
  const slug = slugify(name, 80);
  if (!slug) return { status: "error", message: "Use letters or numbers in the name." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("building_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("building_types")
    .insert({ name, slug, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error?.code === "23505") return { status: "error", message: "This building type already exists." };
  if (error) return { status: "error", message: dbErrorMessage(error) };

  await supabase.rpc("log_activity", {
    p_action: "building_type.created",
    p_entity_type: "building_type",
    p_metadata: { name },
  });
  refresh();
  updateTag(LISTINGS_TAG);
  return { status: "success", message: `“${name}” added.` };
}

export async function setBuildingTypeActiveAction(id: string, active: boolean): Promise<SimpleState> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("properties", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("building_types").update({ is_active: active }).eq("id", id);
  if (error) return { status: "error", message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: active ? "building_type.activated" : "building_type.deactivated",
    p_entity_type: "building_type",
    p_entity_id: id,
  });
  refresh();
  updateTag(LISTINGS_TAG);
  return {
    status: "success",
    message: active ? "Building type activated." : "Building type hidden from new properties.",
  };
}
