"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parsePhoneStrict } from "@/features/enquiries/server";
import { publicEnv } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { safeCustomerPath } from "./redirects";
import { getCustomer, requireCustomer } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CustomerFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** Starts Google sign-in. `favourite` (a property id) is saved automatically after sign-in. */
export async function startGoogleSignInAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const next = safeCustomerPath(formData.get("next"));
  const favourite = String(formData.get("favourite") ?? "");
  const callback = new URL("/auth/callback", publicEnv().NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", next);
  if (UUID.test(favourite)) callback.searchParams.set("favourite", favourite);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) {
    return { status: "error", message: "Google sign-in is not available right now. Please try again later." };
  }
  redirect(data.url);
}

export async function signOutCustomerAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?signed_out=1");
}

/** Favourite state for the current visitor (used by the heart buttons). */
export async function getFavouriteStateAction(): Promise<{ signedIn: boolean; isStaff: boolean; ids: string[] }> {
  const customer = await getCustomer();
  if (!customer) return { signedIn: false, isStaff: false, ids: [] };
  if (customer.isStaff || !customer.profile) return { signedIn: true, isStaff: true, ids: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from("favourites")
    .select("property_id")
    .eq("customer_id", customer.userId)
    .limit(500);
  return { signedIn: true, isStaff: false, ids: (data ?? []).map((row) => row.property_id) };
}

export async function toggleFavouriteAction(
  propertyId: string,
): Promise<{ ok: true; favourited: boolean } | { ok: false; reason: "sign_in" | "staff" | "error" }> {
  if (!UUID.test(propertyId)) return { ok: false, reason: "error" };
  const customer = await getCustomer();
  if (!customer) return { ok: false, reason: "sign_in" };
  if (customer.isStaff || !customer.profile) return { ok: false, reason: "staff" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("favourites")
    .select("property_id")
    .eq("customer_id", customer.userId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("favourites")
      .delete()
      .eq("customer_id", customer.userId)
      .eq("property_id", propertyId);
    return error ? { ok: false, reason: "error" } : { ok: true, favourited: false };
  }
  // RLS only allows favouriting your own account and listed properties.
  const { error } = await supabase.from("favourites").insert({ customer_id: customer.userId, property_id: propertyId });
  return error ? { ok: false, reason: "error" } : { ok: true, favourited: true };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name.").max(120, "Use 120 characters or fewer."),
});

export async function updateProfileAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const customer = await requireCustomer();
  if (!customer) redirect("/account/login");
  const parsed = profileSchema.safeParse({ full_name: formData.get("full_name") ?? "" });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) fieldErrors.full_name = parsed.error.issues[0]?.message ?? "Enter your name.";
  let phone: string | null = null;
  const rawPhone = String(formData.get("phone") ?? "").trim();
  if (rawPhone) {
    const result = parsePhoneStrict(rawPhone, String(formData.get("phone_country") ?? "NG"));
    if (result.ok) phone = result.e164;
    else fieldErrors.phone = "Enter a valid phone number, or leave it empty.";
  }
  if (Object.keys(fieldErrors).length || !parsed.success) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_profiles")
    .update({ full_name: parsed.data.full_name, phone })
    .eq("id", customer.userId);
  if (error) return { status: "error", message: "Your profile could not be saved. Please try again." };
  refresh();
  return { status: "success", message: "Profile saved." };
}

/**
 * Deletes the customer's account and personal profile, favourites included. Inspection
 * requests stay with the company (they are business records) but are no longer linked to
 * the account. Requires typing DELETE.
 */
export async function deleteAccountAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const customer = await requireCustomer();
  if (!customer) redirect("/account/login");
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") {
    return { status: "error", fieldErrors: { confirm: "Type DELETE to confirm." } };
  }
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(customer.userId);
  if (error) return { status: "error", message: "Your account could not be deleted. Please try again or contact us." };
  await service.rpc("log_activity_as", {
    p_actor_id: customer.userId,
    p_actor_type: "customer",
    p_action: "customer.account_deleted",
  });
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?account_deleted=1");
}
