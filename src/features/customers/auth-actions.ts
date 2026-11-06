"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getAuthClaims } from "@/features/auth/admin-session";
import { emailHash } from "@/features/auth/crypto";
import { requestMeta } from "@/features/auth/request-meta";
import { fieldErrors } from "@/features/auth/schemas";
import { logSecurityEvent, withinRateLimit } from "@/features/auth/security-log";
import { verifyTurnstile } from "@/features/enquiries/server";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CustomerFormState } from "./actions";
import {
  CUSTOMER_RATE_LIMITS as LIMITS,
  TOKEN_HASH,
  changePasswordSchema,
  customerEmail,
  customerLoginSchema,
  newCustomerPasswordSchema,
  registerSchema,
} from "./auth-schemas";
import {
  clearResetMarker,
  hasResetMarker,
  isStaffAccount,
  sendCustomerResetLink,
  sendVerificationLink,
  sessionIdFromToken,
  setResetMarker,
} from "./auth-server";
import { safeCustomerPath } from "./redirects";
import { requireCustomer } from "./session";

/**
 * Customer sign-up, sign-in and password recovery (Supabase email + password).
 * Completely separate from staff sign-in: staff accounts are refused on every customer form,
 * and customer accounts can never pass the dashboard's admin checks.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOO_MANY = "Too many attempts. Please wait a while and try again.";
const BOT_CHECK = "Please complete the security check and try again.";
const INVALID_LOGIN = "The email or password is incorrect.";
const LINK_INVALID = "This link is invalid or has expired. Request a new one.";
const CHECK_INBOX = "check-inbox";

function text(formData: FormData, name: string, max = 300): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
}

function favouriteFrom(formData: FormData): string | null {
  const value = text(formData, "favourite", 64);
  return UUID.test(value) ? value : null;
}

function passwordError(code: string | undefined): string {
  if (code === "weak_password") return "This password is too weak or has appeared in a data breach. Choose another.";
  if (code === "same_password") return "Choose a password different from your current one.";
  return "The password could not be saved. Please try again.";
}

async function saveFavourite(userId: string, propertyId: string | null) {
  if (!propertyId) return;
  const supabase = await createClient();
  // RLS: only for this customer and only for listed properties.
  await supabase
    .from("favourites")
    .upsert(
      { customer_id: userId, property_id: propertyId },
      { onConflict: "customer_id,property_id", ignoreDuplicates: true },
    );
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export async function registerAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const parsed = registerSchema.safeParse({
    full_name: text(formData, "full_name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) return { status: "error", message: BOT_CHECK };

  const { full_name, email, password } = parsed.data;
  const meta = await requestMeta();
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`customer-register:ip:${meta.ipHash}`, LIMITS.registerPerIp),
    withinRateLimit(`customer-email-link:email:${emailHash(email)}`, LIMITS.emailLinkPerEmail),
  ]);
  if (!ipOk || !emailOk) {
    await logSecurityEvent("customer_register_rate_limited", meta, { emailHash: emailHash(email) });
    return { status: "error", message: TOO_MANY };
  }

  const next = safeCustomerPath(text(formData, "next") || "/account");
  const favourite = favouriteFrom(formData);
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name },
  });

  if (error?.code === "weak_password") return { status: "error", fieldErrors: { password: passwordError(error.code) } };
  if (error && error.code !== "email_exists") {
    return { status: "error", message: "Your account could not be created. Please try again." };
  }

  if (data.user) {
    const { error: profileError } = await service.from("customer_profiles").insert({ id: data.user.id, full_name });
    if (profileError) {
      await service.auth.admin.deleteUser(data.user.id);
      return { status: "error", message: "Your account could not be created. Please try again." };
    }
    await logSecurityEvent("customer_registered", meta, { actorId: data.user.id });
  }
  // Existing email: resend the activation link if it is an unverified customer account, and
  // show the same message either way, so the form never reveals which emails are registered.
  await sendVerificationLink(email, meta, { next, favourite });
  return { status: "success", message: CHECK_INBOX };
}

// ---------------------------------------------------------------------------
// Activation link
// ---------------------------------------------------------------------------
export async function resendVerificationAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = customerEmail.safeParse(text(formData, "email"));
  if (!parsed.success) return { status: "error", fieldErrors: { email: parsed.error.issues[0]?.message ?? "" } };
  const meta = await requestMeta();
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`customer-email-link:ip:${meta.ipHash}`, LIMITS.emailLinkPerIp),
    withinRateLimit(`customer-email-link:email:${emailHash(parsed.data)}`, LIMITS.emailLinkPerEmail),
  ]);
  if (!ipOk || !emailOk) return { status: "error", message: TOO_MANY };
  await sendVerificationLink(parsed.data, meta, {
    next: safeCustomerPath(text(formData, "next") || "/account"),
    favourite: favouriteFrom(formData),
  });
  return { status: "success", message: CHECK_INBOX };
}

export async function confirmEmailAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const token = text(formData, "token_hash", 250);
  if (!TOKEN_HASH.test(token)) return { status: "error", message: LINK_INVALID };
  const meta = await requestMeta();
  if (!(await withinRateLimit(`customer-link-confirm:ip:${meta.ipHash}`, LIMITS.linkConfirmPerIp))) {
    return { status: "error", message: TOO_MANY };
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { data, error } = await supabase.auth.verifyOtp({ type: "email", token_hash: token });
  if (error || !data.user) {
    await logSecurityEvent("customer_verify_link_invalid", meta, { metadata: { code: error?.code ?? null } });
    return { status: "error", message: LINK_INVALID };
  }
  if (await isStaffAccount(data.user.id)) {
    await supabase.auth.signOut({ scope: "local" });
    return { status: "error", message: LINK_INVALID };
  }
  await logSecurityEvent("customer_email_verified", meta, { actorId: data.user.id });
  await saveFavourite(data.user.id, favouriteFrom(formData));
  redirect(safeCustomerPath(text(formData, "next") || "/account"));
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------
export interface LoginState extends CustomerFormState {
  email?: string;
  unverified?: boolean;
}

export async function customerLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = text(formData, "email", 254);
  const parsed = customerLoginSchema.safeParse({ email: rawEmail, password: text(formData, "password", 300) });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), email: rawEmail };

  const { email, password } = parsed.data;
  const meta = await requestMeta();
  const eHash = emailHash(email);
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`customer-login:ip:${meta.ipHash}`, LIMITS.loginPerIp),
    withinRateLimit(`customer-login:email:${eHash}`, LIMITS.loginPerEmail),
  ]);
  if (!ipOk || !emailOk) {
    await logSecurityEvent("customer_login_rate_limited", meta, { emailHash: eHash });
    return { status: "error", message: TOO_MANY, email };
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") {
    return {
      status: "error",
      message: "Your email address is not verified yet. Use the link we emailed you, or send a new one.",
      email,
      unverified: true,
    };
  }
  if (error || !data.user) {
    await logSecurityEvent("customer_login_failed", meta, {
      emailHash: eHash,
      metadata: { code: error?.code ?? null },
    });
    return { status: "error", message: INVALID_LOGIN, email };
  }

  const service = createServiceClient();
  const [staff, { data: profile }] = await Promise.all([
    isStaffAccount(data.user.id),
    service.from("customer_profiles").select("id").eq("id", data.user.id).maybeSingle(),
  ]);
  if (staff || !profile) {
    // Same answer as a wrong password: staff use the dashboard sign-in, never this one.
    await supabase.auth.signOut({ scope: "local" });
    await logSecurityEvent("customer_login_denied", meta, { actorId: data.user.id, emailHash: eHash });
    return { status: "error", message: INVALID_LOGIN, email };
  }

  await saveFavourite(data.user.id, favouriteFrom(formData));
  redirect(safeCustomerPath(text(formData, "next") || "/account"));
}

// ---------------------------------------------------------------------------
// Forgot / reset password
// ---------------------------------------------------------------------------
export async function customerForgotPasswordAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = customerEmail.safeParse(text(formData, "email", 254));
  if (!parsed.success) return { status: "error", fieldErrors: { email: parsed.error.issues[0]?.message ?? "" } };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) return { status: "error", message: BOT_CHECK };

  const meta = await requestMeta();
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`customer-email-link:ip:${meta.ipHash}`, LIMITS.emailLinkPerIp),
    withinRateLimit(`customer-reset:email:${emailHash(parsed.data)}`, LIMITS.emailLinkPerEmail),
  ]);
  if (!ipOk || !emailOk) return { status: "error", message: TOO_MANY };

  await sendCustomerResetLink(parsed.data, meta);
  return { status: "success", message: CHECK_INBOX };
}

export async function confirmResetLinkAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const token = text(formData, "token_hash", 250);
  if (!TOKEN_HASH.test(token)) return { status: "error", message: LINK_INVALID };
  const meta = await requestMeta();
  if (!(await withinRateLimit(`customer-link-confirm:ip:${meta.ipHash}`, LIMITS.linkConfirmPerIp))) {
    return { status: "error", message: TOO_MANY };
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
  if (error || !data.session || !data.user || (await isStaffAccount(data.user.id))) {
    if (data?.session) await supabase.auth.signOut({ scope: "local" });
    await logSecurityEvent("customer_password_reset_link_invalid", meta, { metadata: { code: error?.code ?? null } });
    return { status: "error", message: LINK_INVALID };
  }
  await setResetMarker(sessionIdFromToken(data.session.access_token));
  redirect("/account/reset-password");
}

export async function customerResetPasswordAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = newCustomerPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const claims = await getAuthClaims();
  if (!claims || !(await hasResetMarker(claims.sessionId)) || (await isStaffAccount(claims.userId))) {
    return { status: "error", message: LINK_INVALID };
  }
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(claims.userId, { password: parsed.data.password });
  if (error) return { status: "error", fieldErrors: { password: passwordError(error.code) } };

  const meta = await requestMeta();
  await clearResetMarker();
  // Sign out every device, including this one; the customer signs in with the new password.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  await logSecurityEvent("customer_password_reset_completed", meta, { actorId: claims.userId });
  redirect("/account/login?reason=password_updated");
}

// ---------------------------------------------------------------------------
// Change password (signed in)
// ---------------------------------------------------------------------------
export async function changePasswordAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const customer = await requireCustomer();
  if (!customer?.email) redirect("/account/login");
  const parsed = changePasswordSchema.safeParse({
    current: text(formData, "current"),
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (!(await withinRateLimit(`customer-change-password:${customer.userId}`, LIMITS.changePasswordPerUser))) {
    return { status: "error", message: TOO_MANY };
  }

  // Check the current password without touching this browser's session.
  const { url, publishableKey } = supabasePublicConfig();
  const check = createStatelessClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: verified, error: checkError } = await check.auth.signInWithPassword({
    email: customer.email,
    password: parsed.data.current,
  });
  if (checkError || verified.user?.id !== customer.userId) {
    return { status: "error", fieldErrors: { current: "Your current password is incorrect." } };
  }
  await check.auth.signOut({ scope: "local" });

  const { error } = await createServiceClient().auth.admin.updateUserById(customer.userId, {
    password: parsed.data.password,
  });
  if (error) return { status: "error", fieldErrors: { password: passwordError(error.code) } };

  // Keep this device signed in; sign out every other device.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });
  await logSecurityEvent("customer_password_changed", await requestMeta(), { actorId: customer.userId });
  return { status: "success", message: "Password changed. Other devices have been signed out." };
}
