import "server-only";
import { cache } from "react";
import { getAuthClaims } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The signed-in customer, if any. Customer accounts are separate from staff accounts (owner
 * brief): a user with an admin_users row is treated as staff and gets no customer features,
 * and customers never get dashboard access (that requires an OTP-verified admin session).
 */
export interface CustomerSession {
  userId: string;
  email: string | null;
  isStaff: boolean;
  profile: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
}

export const getCustomer = cache(async (): Promise<CustomerSession | null> => {
  const claims = await getAuthClaims();
  if (!claims) return null;
  const service = createServiceClient();
  const [{ data: staff }, supabase] = await Promise.all([
    service.from("admin_users").select("id").eq("id", claims.userId).maybeSingle(),
    createClient(),
  ]);
  const [{ data: profile }, { data: user }] = await Promise.all([
    supabase.from("customer_profiles").select("full_name, avatar_url, phone").eq("id", claims.userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  return { userId: claims.userId, email: user.user?.email ?? null, isStaff: Boolean(staff), profile: profile ?? null };
});

/** For pages and actions that need a customer account (signed in, not staff, with a profile). */
export async function requireCustomer(): Promise<
  (CustomerSession & { profile: NonNullable<CustomerSession["profile"]> }) | null
> {
  const customer = await getCustomer();
  if (!customer || customer.isStaff || !customer.profile) return null;
  return customer as CustomerSession & { profile: NonNullable<CustomerSession["profile"]> };
}
