import "server-only";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";
import type { PropertyKind, PropertyStatus } from "./options";

/**
 * Dashboard reads. Each query checks the permission itself and uses the RLS-scoped client,
 * so the database enforces access again.
 */
export const PAGE_SIZE = 20;

export interface PropertyListFilters {
  status?: PropertyStatus;
  kind?: PropertyKind;
  q?: string;
  duplicates?: boolean;
  page: number;
}

export async function listProperties(filters: PropertyListFilters) {
  await requireAdminPermission("properties", "view");
  const supabase = await createClient();
  const from = (filters.page - 1) * PAGE_SIZE;

  let query = supabase
    .from("properties")
    .select(
      "id, kind, purpose, title, status, state, city, location_text, effective_price, price_period, duplicate_state, is_featured, updated_at, estate:estates(name)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.duplicates) query = query.eq("duplicate_state", "flagged");
  if (filters.q) query = query.textSearch("search_vector", filters.q, { type: "websearch", config: "english" });

  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load properties.");
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getPropertyForEdit(id: string) {
  await requireAdminPermission("properties", "view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "*, estate:estates(id, name), building_type:building_types(id, name), images:property_images(id, storage_path, alt_text, width, height, sort_order, is_cover)",
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "property_images" })
    .maybeSingle();
  if (error) throw new Error("Unable to load the property.");
  if (!data) return null;

  let duplicate: { id: string; title: string } | null = null;
  if (data.duplicate_of) {
    const { data: match } = await supabase
      .from("properties")
      .select("id, title")
      .eq("id", data.duplicate_of)
      .maybeSingle();
    duplicate = match ?? { id: data.duplicate_of, title: "another property" };
  }
  return { ...data, duplicate };
}

export async function listEstateOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("estates").select("id, name, is_active").order("name");
  return data ?? [];
}

export async function listBuildingTypeOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("building_types")
    .select("id, name, is_active")
    .order("sort_order")
    .order("name");
  return data ?? [];
}
