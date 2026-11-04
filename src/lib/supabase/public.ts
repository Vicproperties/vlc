import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabasePublicConfig } from "./config";

/**
 * Cookie-less client with the `anon` role, for public data on the server.
 * Safe inside `"use cache"` scopes because it never depends on the visitor's session:
 * every visitor sees exactly what RLS allows the anonymous role to see.
 */
export function createPublicClient() {
  const { url, publishableKey } = supabasePublicConfig();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
