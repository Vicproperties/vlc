import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import type { Database } from "@/types/database";

/**
 * Integration helpers for the access-control suite. Runs against the DEVELOPMENT Supabase
 * project only (credentials from .env.local). Every user and row created here is tagged
 * with the run id and removed in `cleanup()`.
 */
export type DB = SupabaseClient<Database>;

export const RUN_ID = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const EMAIL_DOMAIN = "example.com";
const PASSWORD = `T3st!${randomBytes(12).toString("hex")}`;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for integration tests (.env.local).`);
  return value;
}

/**
 * Safety: this suite creates and deletes users and data. It refuses to run against any
 * project other than the development project.
 */
const DEV_PROJECT_REF = "tcfpnbliwjlinwlgzmkc";

export const url = () => {
  const value = env("NEXT_PUBLIC_SUPABASE_URL");
  if (new URL(value).hostname !== `${DEV_PROJECT_REF}.supabase.co`) {
    throw new Error("Integration tests may only run against the development Supabase project.");
  }
  return value;
};
const publishableKey = () => env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function serviceClient(): DB {
  return createClient<Database>(url(), env("SUPABASE_SECRET_KEY"), noSession);
}

export function anonClient(): DB {
  return createClient<Database>(url(), publishableKey(), noSession);
}

function userClient(accessToken: string): DB {
  return createClient<Database>(url(), publishableKey(), {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Random, low-similarity text so duplicate detection never links unrelated test rows. */
export function uniqueText(prefix: string): string {
  return `${prefix} ${randomBytes(6).toString("hex")}${RUN_ID}`;
}

export interface TestUser {
  id: string;
  email: string;
  sessionId: string;
  client: DB;
}

function decodeSessionId(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
  if (!payload.session_id) throw new Error("JWT has no session_id claim");
  return payload.session_id;
}

export async function createUser(label: string): Promise<TestUser> {
  const service = serviceClient();
  const email = `rls-test-${label}-${RUN_ID}@${EMAIL_DOMAIN}`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);

  const signIn = await anonClient().auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error || !signIn.data.session) throw new Error(`signIn(${label}): ${signIn.error?.message}`);

  const token = signIn.data.session.access_token;
  return { id: data.user.id, email, sessionId: decodeSessionId(token), client: userClient(token) };
}

type Module = Database["public"]["Enums"]["admin_module"];
type Perms = Partial<Record<"can_view" | "can_create" | "can_edit" | "can_publish" | "can_delete", boolean>>;

export async function makeAdmin(
  user: TestUser,
  opts: { role: "super_admin" | "sub_admin"; verified: boolean; permissions?: Partial<Record<Module, Perms>> },
) {
  const service = serviceClient();
  const insert = await service
    .from("admin_users")
    .insert({ id: user.id, email: user.email, full_name: `Test ${opts.role}`, role: opts.role });
  if (insert.error) throw new Error(`admin_users insert: ${insert.error.message}`);

  for (const [module, perms] of Object.entries(opts.permissions ?? {})) {
    const res = await service
      .from("admin_permissions")
      .insert({ admin_id: user.id, module: module as Module, ...perms });
    if (res.error) throw new Error(`admin_permissions insert: ${res.error.message}`);
  }

  const created = await service.rpc("admin_session_create", {
    p_session_id: user.sessionId,
    p_admin_id: user.id,
    p_ttl: "12 hours",
  });
  if (created.error) throw new Error(`admin_session_create: ${created.error.message}`);

  if (opts.verified) {
    const verified = await service.rpc("admin_session_mark_verified", { p_session_id: user.sessionId });
    if (verified.error) throw new Error(`admin_session_mark_verified: ${verified.error.message}`);
  }
}

/**
 * Removes everything this run created. Uses a direct database connection so the
 * last-super-admin guard can be bypassed for test accounts only (migration 0010).
 */
function dbClient() {
  url(); // refuses anything but the development project
  return new pg.Client({
    connectionString: env("SUPABASE_DB_URL"),
    // Development database only. The Supabase pooler presents a certificate not in Node's
    // default trust store; production tooling must pin the Supabase CA instead.
    ssl: { rejectUnauthorized: false },
  });
}

/** Runs SQL directly (e.g. to age a session or expire a code). Dev project only. */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = dbClient();
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/**
 * Runs statements in one direct-database transaction that is ALWAYS rolled back, so a
 * test can set up a state (e.g. "only one super admin left") without changing real rows.
 */
export async function inRolledBackTransaction<T>(
  fn: (query: (text: string, params?: unknown[]) => Promise<unknown>) => Promise<T>,
) {
  const client = dbClient();
  await client.connect();
  try {
    await client.query("begin");
    return await fn((text, params = []) => client.query(text, params));
  } finally {
    await client.query("rollback").catch(() => undefined);
    await client.end();
  }
}

export async function cleanup(propertyIds: string[]) {
  const client = dbClient();
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local app.allow_admin_purge = 'on'");
    // Test data from THIS run, plus leftovers over an hour old from interrupted runs. Other
    // test files may be running in parallel, so their recent data is never touched.
    // Test titles always end with the uniqueText() token (12 hex chars + run id).
    const testTitle = "[0-9a-f]{12}[0-9a-z]{6,12}[0-9a-f]{6}$";
    const thisRun = `[0-9a-f]{12}${RUN_ID}$`;
    const stale = "created_at < now() - interval '1 hour'";
    const testRow = `(title ~ $2 and (title ~ $3 or ${stale}))`;
    await client.query(
      `delete from public.inspection_requests where property_id = any($1::uuid[])
         or property_id in (select id from public.properties where ${testRow})`,
      [propertyIds, testTitle, thisRun],
    );
    await client.query(`delete from public.properties where id = any($1::uuid[]) or ${testRow}`, [
      propertyIds,
      testTitle,
      thisRun,
    ]);
    await client.query(`delete from public.estates where name::text ~ $1 and (name::text ~ $2 or ${stale})`, [
      testTitle,
      thisRun,
    ]);
    await client.query(`delete from public.blog_posts where title ~ $1 and (title ~ $2 or ${stale})`, [
      testTitle,
      thisRun,
    ]);
    await client.query(`delete from auth.users where email like $1 and (email like $2 or ${stale})`, [
      `rls-test-%@${EMAIL_DOMAIN}`,
      `%-${RUN_ID}@${EMAIL_DOMAIN}`,
    ]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

/** Expect a PostgREST call to be refused (permission denied / RLS / trigger). */
export function isDenied(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error &&
    (error.code === "42501" || /permission denied|row-level security|not authorized/i.test(error.message ?? ""))
  );
}
