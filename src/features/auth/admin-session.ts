import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_LOGIN_PATH, ADMIN_VERIFY_PATH } from "./constants";

/**
 * Data Access Layer for the admin area. Every dashboard page, Server Action and Route
 * Handler must call `requireAdmin()` / `requireAdminPermission()` itself — layouts and the
 * proxy are not an authorization boundary. The database enforces the same rules again
 * through RLS, so a missing check here fails closed rather than leaking data.
 */
export type AdminDbModule = Database["public"]["Enums"]["admin_module"];
export type AdminAction = Database["public"]["Enums"]["admin_action"];
export type SessionStatus = "none" | "pending_otp" | "verified" | "expired";

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  publish: boolean;
  delete: boolean;
}

export interface AdminContext {
  id: string;
  email: string;
  fullName: string;
  role: Database["public"]["Enums"]["admin_role"];
  isSuperAdmin: boolean;
  permissions: Partial<Record<AdminDbModule, ModulePermissions>>;
}

export interface AuthClaims {
  userId: string;
  sessionId: string;
}

/** Verified JWT claims for the current request (signature checked by Supabase). */
export const getAuthClaims = cache(async (): Promise<AuthClaims | null> => {
  // Session checks are request-time only: never part of a prerender or runtime prefetch
  // (the Supabase client also reads the clock while it starts).
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const { sub, session_id: sessionId } = data.claims as { sub?: string; session_id?: string };
  if (!sub || !sessionId) return null;
  return { userId: sub, sessionId };
});

/**
 * Admin session state for this request. Calls the database once per request (memoised),
 * which also records activity for the idle timeout. Throws if the database cannot be
 * reached, so the dashboard shows an error instead of granting access.
 */
export const getAdminSession = cache(
  async (): Promise<{ status: SessionStatus; claims: AuthClaims | null; admin: AdminContext | null }> => {
    const claims = await getAuthClaims();
    if (!claims) return { status: "none", claims: null, admin: null };

    const supabase = await createClient();
    const { data: status, error } = await supabase.rpc("admin_session_status");
    if (error) throw new Error("Unable to verify the admin session.");
    if (status !== "verified") return { status: status as SessionStatus, claims, admin: null };

    const [profile, perms] = await Promise.all([
      supabase.from("admin_users").select("id, email, full_name, role").eq("id", claims.userId).single(),
      supabase.rpc("my_admin_permissions"),
    ]);
    if (profile.error || perms.error) throw new Error("Unable to load the admin profile.");

    const permissions: AdminContext["permissions"] = {};
    let isSuperAdmin = false;
    for (const row of perms.data ?? []) {
      isSuperAdmin ||= row.is_super_admin;
      permissions[row.module] = {
        view: row.can_view,
        create: row.can_create,
        edit: row.can_edit,
        publish: row.can_publish,
        delete: row.can_delete,
      };
    }

    return {
      status: "verified",
      claims,
      admin: {
        id: profile.data.id,
        email: profile.data.email,
        fullName: profile.data.full_name,
        role: profile.data.role,
        isSuperAdmin,
        permissions,
      },
    };
  },
);

/** Redirects anyone who is not a verified, active admin. */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await getAdminSession();
  if (session.status === "verified" && session.admin) return session.admin;
  if (session.status === "pending_otp") redirect(ADMIN_VERIFY_PATH);
  redirect(session.status === "expired" ? `${ADMIN_LOGIN_PATH}?reason=expired` : ADMIN_LOGIN_PATH);
}

export function can(admin: AdminContext, module: AdminDbModule, action: AdminAction): boolean {
  return admin.isSuperAdmin || admin.permissions[module]?.[action] === true;
}

export class AdminPermissionError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "AdminPermissionError";
  }
}

/** For Server Actions: verified admin with the given permission, or throws. */
export async function requireAdminPermission(module: AdminDbModule, action: AdminAction): Promise<AdminContext> {
  const admin = await requireAdmin();
  if (!can(admin, module, action)) throw new AdminPermissionError();
  return admin;
}
