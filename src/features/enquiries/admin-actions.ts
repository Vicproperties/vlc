"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type InspectionStatus = Database["public"]["Enums"]["inspection_status"];
const STATUSES: InspectionStatus[] = ["pending", "confirmed", "completed", "cancelled"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Result {
  ok: boolean;
  message: string;
}

function assertId(id: string) {
  if (!UUID.test(id)) throw new Error("Invalid id.");
}

// ---------------------------------------------------------------------------
// Inspection requests
// ---------------------------------------------------------------------------
export async function changeInspectionStatusAction(id: string, status: string, note: string): Promise<Result> {
  assertId(id);
  if (!STATUSES.includes(status as InspectionStatus)) throw new Error("Invalid status.");
  await requireAdminPermission("inspections", "edit");
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_inspection_status", {
    p_request_id: id,
    p_status: status as InspectionStatus,
    p_note: note.trim().slice(0, 1000) || undefined,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: "inspection.status_changed",
    p_entity_type: "inspection_request",
    p_entity_id: id,
    p_metadata: { to: status },
  });
  refresh();
  return { ok: true, message: "Status updated." };
}

export async function saveInspectionNotesAction(id: string, notes: string): Promise<Result> {
  assertId(id);
  await requireAdminPermission("inspections", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("inspection_requests")
    .update({ admin_notes: notes.trim().slice(0, 5000) || null })
    .eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Notes saved." };
}

export async function deleteInspectionAction(id: string): Promise<Result> {
  assertId(id);
  await requireAdminPermission("inspections", "delete");
  const supabase = await createClient();
  const { error, count } = await supabase.from("inspection_requests").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!count) return { ok: false, message: "This request no longer exists." };
  await supabase.rpc("log_activity", {
    p_action: "inspection.deleted",
    p_entity_type: "inspection_request",
    p_entity_id: id,
  });
  redirect("/admin/inspections?deleted=1");
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------
export async function setMessageReadAction(id: string, read: boolean): Promise<Result> {
  assertId(id);
  await requireAdminPermission("enquiries", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("contact_submissions").update({ is_read: read }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: read ? "Marked as read." : "Marked as unread." };
}

export async function setMessageArchivedAction(id: string, archived: boolean): Promise<Result> {
  assertId(id);
  await requireAdminPermission("enquiries", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_submissions")
    .update({ archived_at: archived ? new Date().toISOString() : null, is_read: true })
    .eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: archived ? "Message archived." : "Message moved back to the inbox." };
}

export async function deleteMessageAction(id: string): Promise<Result> {
  assertId(id);
  await requireAdminPermission("enquiries", "delete");
  const supabase = await createClient();
  const { error, count } = await supabase.from("contact_submissions").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!count) return { ok: false, message: "This message no longer exists." };
  await supabase.rpc("log_activity", {
    p_action: "enquiry.deleted",
    p_entity_type: "contact_submission",
    p_entity_id: id,
  });
  redirect("/admin/inspections/messages?deleted=1");
}
