"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublicConfig } from "./config";

/**
 * Browser client acting as the signed-in user. Only for interactive client features
 * (e.g. favourites). Never trust it for authorization — RLS and server checks do that.
 */
export function createClient() {
  const { url, publishableKey } = supabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
