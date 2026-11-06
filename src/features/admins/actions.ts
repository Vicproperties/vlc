"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type AdminContext, requireAdmin } from "@/features/auth/admin-session";
import { sendAdminPasswordLink } from "@/features/auth/recovery";
import { requestMeta } from "@/features/auth/request-meta";
import { withinRateLimit } from "@/features/auth/security-log";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { Constants } from "@/types/database";
import { type PermissionSet, permissionsFromForm } from "./permissions";

/**
 * Admin Users. Only SUPER admins may invite or change administrators, so a sub-admin can
 * never widen their own access. Writes use the service role (admin_users has no client
 * write policies) and only after that check. The database separately refuses to remove,
 * demote or deactivate the last active super admin.
 */
export interface AdminUserFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface AdminUserResult {
  ok: boolean;
  message: string;
}

const NOT_ALLOWED = "Only a super administrator can manage administrators.";
/** Invites and setup links send email: keep them bounded per super admin. */
const INVITE_LIMIT = [20, 3600] as const;

const nameSchema = z.string().trim().min(2, "Enter the person's full name.").max(120, "Use 120 characters or fewer.");
const roleSchema = z.enum(["super_admin", "sub_admin"], { message: "Choose a role." });
const inviteSchema = z.object({
  full_name: nameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid email address.")
    .pipe(z.email({ error: "Enter a valid email address." })),
  role: roleSchema,
});
const updateSchema = z.object({ id: z.string().uuid(), full_name: nameSchema, role: roleSchema });

async function requireSuperAdmin(): Promise<AdminContext | null> {
  const admin = await requireAdmin();
  return admin.isSuperAdmin ? admin : null;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** One statement for every section, so a permission change is all-or-nothing. */
async function savePermissions(adminId: string, role: "super_admin" | "sub_admin", permissions: PermissionSet) {
  const rows = Constants.public.Enums.admin_module.map((module) => {
    const flags = role === "sub_admin" ? (permissions[module] ?? {}) : {};
    return {
      admin_id: adminId,
      module,
      can_view: flags.view === true,
      can_create: flags.create === true,
      can_edit: flags.edit === true,
      can_publish: flags.publish === true,
      can_delete: flags.delete === true,
    };
  });
  return createServiceClient().from("admin_permissions").upsert(rows, { onConflict: "admin_id,module" });
}

async function logActivity(action: string, adminId: string, metadata: Record<string, string | boolean> = {}) {
  const supabase = await createClient();
  await supabase.rpc("log_activity", {
    p_action: action,
    p_entity_type: "admin_user",
    p_entity_id: adminId,
    p_metadata: metadata,
  });
}

export async function inviteAdminAction(_prev: AdminUserFormState, formData: FormData): Promise<AdminUserFormState> {
  const me = await requireSuperAdmin();
  if (!me) return { status: "error", message: NOT_ALLOWED };

  const parsed = inviteSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  const { full_name: fullName, email, role } = parsed.data;
  const permissions = permissionsFromForm(formData);
  if (role === "sub_admin" && Object.keys(permissions).length === 0) {
    return { status: "error", message: "Tick at least one section this administrator can use." };
  }

  if (!(await withinRateLimit(`admin-invite:${me.id}`, INVITE_LIMIT))) {
    return { status: "error", message: "Too many invitations in the last hour. Please try again later." };
  }

  const service = createServiceClient();
  // Customer and staff accounts stay separate: an email already in use cannot become an admin.
  const { data: existingId, error: lookupError } = await service.rpc("customer_id_for_email", { p_email: email });
  if (lookupError) return { status: "error", message: "Something went wrong. Please try again." };
  if (existingId) {
    const { data: existingAdmin } = await service.from("admin_users").select("id").eq("id", existingId).maybeSingle();
    return {
      status: "error",
      fieldErrors: {
        email: existingAdmin
          ? "This person is already an administrator."
          : "This email is already used by a customer account. Use a different email for dashboard access.",
      },
    };
  }

  // No password: the invited person sets one through the emailed link.
  const created = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.error || !created.data.user) {
    return created.error?.code === "email_exists"
      ? { status: "error", fieldErrors: { email: "This email already has an account." } }
      : { status: "error", message: "The account could not be created. Please try again." };
  }
  const userId = created.data.user.id;

  const inserted = await service
    .from("admin_users")
    .insert({ id: userId, email, full_name: fullName, role, created_by: me.id });
  const saved = inserted.error ? inserted : await savePermissions(userId, role, permissions);
  if (saved.error) {
    // Roll back so a half-created administrator never exists (cascades to admin_users).
    await service.auth.admin.deleteUser(userId);
    return { status: "error", message: dbErrorMessage(saved.error) };
  }

  await logActivity("admin.invited", userId, { role });
  const sent = await sendAdminPasswordLink(email, await requestMeta(), "invite");
  redirect(`/admin/admins/${userId}?invited=${sent ? "1" : "failed"}`);
}

export async function updateAdminAction(_prev: AdminUserFormState, formData: FormData): Promise<AdminUserFormState> {
  const me = await requireSuperAdmin();
  if (!me) return { status: "error", message: NOT_ALLOWED };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  const { id, full_name: fullName, role } = parsed.data;
  if (id === me.id) return { status: "error", message: "You cannot change your own role or access." };

  const permissions = permissionsFromForm(formData);
  if (role === "sub_admin" && Object.keys(permissions).length === 0) {
    return { status: "error", message: "Tick at least one section this administrator can use." };
  }

  const service = createServiceClient();
  // Role first: if the database refuses (last super admin), permissions stay untouched.
  const updated = await service.from("admin_users").update({ full_name: fullName, role }).eq("id", id).select("id");
  if (updated.error) return { status: "error", message: dbErrorMessage(updated.error) };
  if (!updated.data?.length) return { status: "error", message: "This administrator no longer exists." };

  const saved = await savePermissions(id, role, permissions);
  if (saved.error) return { status: "error", message: dbErrorMessage(saved.error) };

  await logActivity("admin.updated", id, { role });
  refresh();
  return { status: "success", message: "Changes saved. They apply on the administrator's next page load." };
}

export async function setAdminActiveAction(id: string, active: boolean): Promise<AdminUserResult> {
  const me = await requireSuperAdmin();
  if (!me) return { ok: false, message: NOT_ALLOWED };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "This administrator no longer exists." };
  if (id === me.id) return { ok: false, message: "You cannot deactivate your own account." };

  const service = createServiceClient();
  const updated = await service
    .from("admin_users")
    .update({ is_active: active, deactivated_at: active ? null : new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (updated.error) return { ok: false, message: dbErrorMessage(updated.error) };
  if (!updated.data?.length) return { ok: false, message: "This administrator no longer exists." };

  if (!active) {
    // Inactive admins already fail every check; revoking also ends their open dashboard sessions.
    await service.rpc("admin_session_revoke", { p_admin_id: id });
  }
  await logActivity(active ? "admin.reactivated" : "admin.deactivated", id);
  refresh();
  return {
    ok: true,
    message: active
      ? "Access restored. They can sign in again."
      : "Access removed. They have been signed out of the dashboard.",
  };
}

export async function resendAdminInviteAction(id: string): Promise<AdminUserResult> {
  const me = await requireSuperAdmin();
  if (!me) return { ok: false, message: NOT_ALLOWED };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "This administrator no longer exists." };

  const { data: target } = await createServiceClient()
    .from("admin_users")
    .select("email, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, message: "This administrator no longer exists." };
  if (!target.is_active) return { ok: false, message: "Restore their access before sending a link." };
  if (!(await withinRateLimit(`admin-invite:${me.id}`, INVITE_LIMIT))) {
    return { ok: false, message: "Too many emails in the last hour. Please try again later." };
  }

  const sent = await sendAdminPasswordLink(target.email, await requestMeta(), "invite");
  if (!sent) return { ok: false, message: "The email could not be sent. Please try again in a few minutes." };
  await logActivity("admin.invite_resent", id);
  return { ok: true, message: `A password setup link was sent to ${target.email}.` };
}
