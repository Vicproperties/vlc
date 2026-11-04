import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverEnv } from "@/lib/env/server";
import { supabasePublicConfig } from "./config";

/**
 * SERVICE-ROLE CLIENT — BYPASSES ROW LEVEL SECURITY.
 *
 * Allowed only in audited server modules that perform their own authorization first:
 *   - public form submissions (after validation, Turnstile and rate limiting)
 *   - analytics ingestion
 *   - admin session / OTP / rate-limit RPCs
 *   - admin account management (after verifying the caller is a super admin)
 *   - bulk import commits (after verifying properties:create)
 *
 * Never import from client components (enforced by `server-only`), never pass the client
 * or its results unfiltered to the browser, and never use it to read data on behalf of a
 * user when the RLS-scoped client would do.
 */
export function createServiceClient() {
  const { url } = supabasePublicConfig();
  return createClient<Database>(url, serverEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
