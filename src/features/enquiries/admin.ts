import "server-only";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";
import type { StatusTone } from "@/components/ui/states";
import type { Database } from "@/types/database";

/** Dashboard reads for inspection requests (module "inspections") and contact messages ("enquiries"). */
export type InspectionStatus = Database["public"]["Enums"]["inspection_status"];
export const INSPECTION_STATUSES: InspectionStatus[] = ["pending", "confirmed", "completed", "cancelled"];
export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const STATUS_TONES: Record<InspectionStatus, StatusTone> = {
  pending: "warning",
  confirmed: "accent",
  completed: "success",
  cancelled: "neutral",
};
export const ADMIN_PAGE_SIZE = 25;

/** Search text safe to place inside a PostgREST `or=(...ilike...)` filter. */
function searchTerm(q: string): string {
  return q
    .replace(/[^\p{L}\p{N} +@.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function listInspections(filters: { status: InspectionStatus | "open" | "all"; q: string; page: number }) {
  await requireAdminPermission("inspections", "view");
  const supabase = await createClient();
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from("inspection_requests")
    .select("id, full_name, phone, property_snapshot, preferred_date, preferred_time, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (filters.status === "open") query = query.in("status", ["pending", "confirmed"]);
  else if (filters.status !== "all") query = query.eq("status", filters.status);
  const term = searchTerm(filters.q);
  if (term) query = query.or(`full_name.ilike."*${term}*",phone.ilike."*${term.replace(/\s/g, "")}*"`);
  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load inspection requests.");
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getInspection(id: string) {
  await requireAdminPermission("inspections", "view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_requests")
    .select(
      "id, property_id, property_snapshot, customer_id, full_name, phone, email, preferred_date, preferred_time, message, status, admin_notes, consent_at, created_at, updated_at, history:inspection_status_history(id, from_status, to_status, changed_by, note, created_at)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "inspection_status_history", ascending: false })
    .maybeSingle();
  if (error) throw new Error("Unable to load the inspection request.");
  if (!data) return null;

  // Names of staff who changed the status (admins with "admins" view may see all; others
  // see names only for themselves, so fall back to "Staff").
  const staffIds = [...new Set(data.history.map((h) => h.changed_by).filter((v): v is string => Boolean(v)))];
  const { data: staff } = staffIds.length
    ? await supabase.from("admin_users").select("id, full_name").in("id", staffIds)
    : { data: [] };
  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  return {
    ...data,
    history: data.history.map((h) => ({ ...h, staffName: h.changed_by ? (names.get(h.changed_by) ?? "Staff") : null })),
  };
}

export async function listMessages(filters: { box: "inbox" | "archived"; q: string; page: number }) {
  await requireAdminPermission("enquiries", "view");
  const supabase = await createClient();
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from("contact_submissions")
    .select("id, name, email, subject, message, is_read, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  query = filters.box === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const term = searchTerm(filters.q);
  if (term) query = query.or(`name.ilike."*${term}*",email.ilike."*${term}*",subject.ilike."*${term}*"`);
  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load messages.");
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getMessage(id: string) {
  await requireAdminPermission("enquiries", "view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_submissions")
    .select("id, name, email, phone, subject, message, is_read, archived_at, consent_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load the message.");
  return data;
}

/** Counts for the dashboard overview, limited to what this admin may see. */
export async function enquiryCounts(can: { inspections: boolean; enquiries: boolean }) {
  const supabase = await createClient();
  const [pending, unread] = await Promise.all([
    can.inspections
      ? supabase.from("inspection_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: null }),
    can.enquiries
      ? supabase
          .from("contact_submissions")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false)
          .is("archived_at", null)
      : Promise.resolve({ count: null }),
  ]);
  return { pendingInspections: pending.count, unreadMessages: unread.count };
}
