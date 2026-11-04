import { randomBytes } from "node:crypto";
import { hashOtp } from "../../src/features/auth/otp-core";
import { RUN_ID, serviceClient, sql } from "../integration/helpers";

/**
 * Test accounts for the admin auth journey. Emails use the `rls-test-` prefix so the shared
 * cleanup removes them. Runs against the development Supabase project only (helpers guard).
 *
 * The app runs with EMAIL_TRANSPORT=disabled, so no email is sent. Tests replace the stored
 * code hash with the hash of a known code, computed exactly as the server does.
 */
export interface TestAdmin {
  id: string;
  email: string;
  password: string;
  name: string;
}

type Module = "properties" | "estates" | "blog" | "admins";
type Flags = Partial<Record<"can_view" | "can_create" | "can_edit" | "can_publish" | "can_delete", boolean>>;

export async function createTestAdmin(
  label: string,
  opts: {
    role?: "super_admin" | "sub_admin";
    view?: Module[];
    permissions?: Partial<Record<Module, Flags>>;
    admin?: boolean;
  } = {},
): Promise<TestAdmin> {
  const service = serviceClient();
  const email = `rls-test-e2e-${label}-${RUN_ID}@example.com`;
  const password = `E2e ${randomBytes(12).toString("hex")}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);

  const name = `Tester ${label}`;
  if (opts.admin !== false) {
    const inserted = await service
      .from("admin_users")
      .insert({ id: data.user.id, email, full_name: name, role: opts.role ?? "sub_admin" });
    if (inserted.error) throw new Error(`admin_users: ${inserted.error.message}`);
    for (const moduleName of opts.view ?? []) {
      const res = await service
        .from("admin_permissions")
        .insert({ admin_id: data.user.id, module: moduleName, can_view: true });
      if (res.error) throw new Error(`admin_permissions: ${res.error.message}`);
    }
    for (const [moduleName, flags] of Object.entries(opts.permissions ?? {})) {
      const res = await service
        .from("admin_permissions")
        .insert({ admin_id: data.user.id, module: moduleName as Module, ...flags });
      if (res.error) throw new Error(`admin_permissions: ${res.error.message}`);
    }
  }
  return { id: data.user.id, email, password, name };
}

/** Replaces the admin's active code with a known one and returns it. */
export async function setKnownCode(adminId: string, code = "246810"): Promise<string> {
  const secret = process.env.ADMIN_OTP_HMAC_SECRET;
  if (!secret) throw new Error("ADMIN_OTP_HMAC_SECRET is required");
  const [row] = await sql<{ session_id: string }>(
    `select session_id from private.admin_otp_challenges
      where admin_id = $1 and consumed_at is null order by created_at desc limit 1`,
    [adminId],
  );
  if (!row) throw new Error("No active code for this admin");
  await sql("update private.admin_otp_challenges set code_hash = $1 where session_id = $2 and consumed_at is null", [
    hashOtp(secret, row.session_id, code),
    row.session_id,
  ]);
  return code;
}

export async function resetAdminRateLimits() {
  await sql("delete from private.rate_limits where key like 'admin-%'");
}

export async function ageAdminSessions(adminId: string, minutes: number) {
  await sql(
    `update private.admin_sessions set last_activity_at = now() - make_interval(mins => $2) where admin_id = $1`,
    [adminId, minutes],
  );
}

export async function recoveryToken(email: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) throw new Error(`generateLink: ${error?.message}`);
  return data.properties.hashed_token;
}
