import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublicConfig } from "./config";

/**
 * Request-scoped client acting AS THE SIGNED-IN USER (or anon). All queries are subject to
 * Row Level Security. Use in Server Components, Server Actions and Route Handlers.
 *
 * Reads cookies, so it cannot be used inside `"use cache"` scopes — use `createPublicClient()`
 * for cached public data instead.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabasePublicConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. Session refresh
          // is handled by src/proxy.ts, so this is safe to ignore.
        }
      },
    },
  });
}
