"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthClaims } from "./admin-session";
import { ADMIN_LOGIN_PATH, ADMIN_SESSION_TTL, ADMIN_VERIFY_PATH, RATE_LIMITS } from "./constants";
import { emailHash, otpHash } from "./crypto";
import { issueAndSendCode } from "./otp-delivery";
import { sendAdminPasswordLink } from "./recovery";
import { safeAdminPath } from "./redirects";
import { requestMeta } from "./request-meta";
import {
  type AuthFormState,
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  otpSchema,
} from "./schemas";
import { logSecurityEvent, withinRateLimit } from "./security-log";

const INVALID_CREDENTIALS = "The email or password is incorrect.";
const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";
const LINK_INVALID = "This link is invalid or has expired. Request a new one.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** `session_id` from an access token Supabase Auth has just issued to this server. */
function sessionIdFromToken(accessToken: string): string {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
    session_id?: string;
  };
  if (!payload.session_id) throw new Error("Auth session is missing a session id.");
  return payload.session_id;
}

// ---------------------------------------------------------------------------
// Step 1: email + password
// ---------------------------------------------------------------------------
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = text(formData, "email").slice(0, 254);
  const next = safeAdminPath(text(formData, "next"));
  const parsed = loginSchema.safeParse({ email: rawEmail, password: text(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), email: rawEmail };

  const { email, password } = parsed.data;
  const meta = await requestMeta();
  const eHash = emailHash(email);

  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`admin-login:ip:${meta.ipHash}`, RATE_LIMITS.loginPerIp),
    withinRateLimit(`admin-login:email:${eHash}`, RATE_LIMITS.loginPerEmail),
  ]);
  if (!ipOk || !emailOk) {
    await logSecurityEvent("admin_login_rate_limited", meta, { emailHash: eHash });
    return { status: "error", message: TOO_MANY, email };
  }

  const supabase = await createClient();
  // Discard any previous session in this browser before starting a new login.
  await supabase.auth.signOut({ scope: "local" });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    await logSecurityEvent("admin_login_failed", meta, { emailHash: eHash, metadata: { code: error?.code ?? null } });
    return { status: "error", message: INVALID_CREDENTIALS, email };
  }

  const service = createServiceClient();
  const { data: admin } = await service
    .from("admin_users")
    .select("id, email, full_name, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!admin?.is_active) {
    // Same response as a wrong password: the form never reveals which accounts are admins.
    await supabase.auth.signOut({ scope: "local" });
    await logSecurityEvent("admin_login_denied", meta, { actorId: data.user.id, emailHash: eHash });
    return { status: "error", message: INVALID_CREDENTIALS, email };
  }

  const sessionId = sessionIdFromToken(data.session.access_token);
  const created = await service.rpc("admin_session_create", {
    p_session_id: sessionId,
    p_admin_id: admin.id,
    p_ttl: ADMIN_SESSION_TTL,
    p_user_agent: meta.userAgent ?? undefined,
    p_ip_hash: meta.ipHash,
  });
  if (created.error) throw new Error("Unable to start the admin session.");

  const result = await issueAndSendCode({
    sessionId,
    adminId: admin.id,
    email: admin.email,
    name: admin.full_name,
    meta,
  });

  const params = new URLSearchParams();
  if (next !== "/admin") params.set("next", next);
  if (result !== "sent") params.set("notice", "send_failed");
  const query = params.toString();
  redirect(query ? `${ADMIN_VERIFY_PATH}?${query}` : ADMIN_VERIFY_PATH);
}

// ---------------------------------------------------------------------------
// Step 2: emailed code
// ---------------------------------------------------------------------------
export async function verifyOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeAdminPath(text(formData, "next"));
  const parsed = otpSchema.safeParse({ code: text(formData, "code").slice(0, 20) });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const claims = await getAuthClaims();
  if (!claims) redirect(`${ADMIN_LOGIN_PATH}?reason=expired`);

  const meta = await requestMeta();
  if (!(await withinRateLimit(`admin-otp:session:${claims.sessionId}`, RATE_LIMITS.otpVerifyPerSession))) {
    await logSecurityEvent("admin_otp_rate_limited", meta, { actorId: claims.userId });
    return { status: "error", message: TOO_MANY };
  }

  const service = createServiceClient();
  const { data: outcome, error } = await service.rpc("admin_otp_verify", {
    p_session_id: claims.sessionId,
    p_code_hash: otpHash(claims.sessionId, parsed.data.code),
  });
  if (error) throw new Error("Unable to verify the code.");

  switch (outcome) {
    case "verified": {
      await logSecurityEvent("admin_login_success", meta, { actorId: claims.userId });
      await service.rpc("log_activity_as", {
        p_actor_id: claims.userId,
        p_actor_type: "admin",
        p_action: "admin.login",
        p_ip_hash: meta.ipHash,
      });
      redirect(next);
    }
    case "invalid":
      await logSecurityEvent("admin_otp_failed", meta, { actorId: claims.userId });
      return { status: "error", fieldErrors: { code: "That code is incorrect. Check the most recent email." } };
    case "expired":
      return { status: "error", message: "This code has expired. Send a new code to continue." };
    case "locked": {
      await logSecurityEvent("admin_otp_locked", meta, { actorId: claims.userId });
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
      redirect(`${ADMIN_LOGIN_PATH}?reason=locked`);
    }
    default:
      return { status: "error", message: "There is no active code. Send a new code to continue." };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function resendOtpAction(_prev: AuthFormState): Promise<AuthFormState> {
  const claims = await getAuthClaims();
  if (!claims) redirect(`${ADMIN_LOGIN_PATH}?reason=expired`);

  const meta = await requestMeta();
  if (!(await withinRateLimit(`admin-otp-resend:session:${claims.sessionId}`, RATE_LIMITS.otpResendPerSession))) {
    await logSecurityEvent("admin_otp_rate_limited", meta, { actorId: claims.userId, metadata: { step: "resend" } });
    return { status: "error", message: TOO_MANY };
  }

  const { data: admin } = await createServiceClient()
    .from("admin_users")
    .select("id, email, full_name, is_active")
    .eq("id", claims.userId)
    .maybeSingle();
  if (!admin?.is_active) redirect(`${ADMIN_LOGIN_PATH}?reason=expired`);

  const result = await issueAndSendCode({
    sessionId: claims.sessionId,
    adminId: admin.id,
    email: admin.email,
    name: admin.full_name,
    meta,
  });

  switch (result) {
    case "sent":
      return { status: "success", message: "A new code has been sent. Earlier codes no longer work." };
    case "cooldown":
      return { status: "error", message: "Please wait a minute before requesting another code." };
    case "limit":
      return { status: "error", message: "Too many codes have been requested. Sign in again to continue." };
    case "send_failed":
      return { status: "error", message: "We could not send the email. Please try again in a minute." };
    default:
      redirect(`${ADMIN_LOGIN_PATH}?reason=expired`);
  }
}

// ---------------------------------------------------------------------------
// Password recovery
// ---------------------------------------------------------------------------
export async function forgotPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = text(formData, "email").slice(0, 254);
  const parsed = forgotPasswordSchema.safeParse({ email: rawEmail });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), email: rawEmail };

  const { email } = parsed.data;
  const meta = await requestMeta();
  const eHash = emailHash(email);
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`admin-forgot:ip:${meta.ipHash}`, RATE_LIMITS.forgotPerIp),
    withinRateLimit(`admin-forgot:email:${eHash}`, RATE_LIMITS.forgotPerEmail),
  ]);
  if (!ipOk || !emailOk) {
    await logSecurityEvent("admin_password_reset_rate_limited", meta, { emailHash: eHash });
    return { status: "error", message: "Too many requests. Please wait an hour and try again.", email };
  }

  // Look-up and sending happen after the response, so response time does not reveal
  // whether the address belongs to an admin.
  after(() => sendAdminPasswordLink(email, meta, "reset"));

  return {
    status: "success",
    message:
      "If an administrator account uses that email, a link to reset the password is on its way. It expires in 1 hour.",
  };
}

export async function confirmRecoveryAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = text(formData, "token_hash");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(token)) return { status: "error", message: LINK_INVALID };

  const meta = await requestMeta();
  if (!(await withinRateLimit(`admin-reset:ip:${meta.ipHash}`, RATE_LIMITS.resetPerIp))) {
    return { status: "error", message: "Too many requests. Please wait an hour and try again." };
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
  if (error || !data.session || !data.user) {
    await logSecurityEvent("admin_password_reset_link_invalid", meta, { metadata: { code: error?.code ?? null } });
    return { status: "error", message: LINK_INVALID };
  }

  const { data: started } = await createServiceClient().rpc("admin_recovery_start", {
    p_session_id: sessionIdFromToken(data.session.access_token),
    p_admin_id: data.user.id,
  });
  if (started !== true) {
    await supabase.auth.signOut({ scope: "local" });
    await logSecurityEvent("admin_password_reset_link_invalid", meta, { actorId: data.user.id });
    return { status: "error", message: LINK_INVALID };
  }
  redirect("/admin/reset-password");
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const claims = await getAuthClaims();
  if (!claims) return { status: "error", message: LINK_INVALID };

  const service = createServiceClient();
  const { data: valid } = await service.rpc("admin_recovery_is_valid", {
    p_session_id: claims.sessionId,
    p_admin_id: claims.userId,
  });
  if (valid !== true) return { status: "error", message: LINK_INVALID };

  const { error } = await service.auth.admin.updateUserById(claims.userId, { password: parsed.data.password });
  if (error) {
    const message =
      error.code === "same_password"
        ? "Choose a password you have not used for this account before."
        : error.code === "weak_password"
          ? "This password is too weak or has appeared in a data breach. Choose another."
          : "The password could not be updated. Please try again.";
    return { status: "error", fieldErrors: { password: message } };
  }

  const meta = await requestMeta();
  await service.rpc("admin_recovery_complete", { p_session_id: claims.sessionId, p_admin_id: claims.userId });
  // Revoke every refresh token of this account (all devices).
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  await logSecurityEvent("admin_password_reset_completed", meta, { actorId: claims.userId });
  await service.rpc("log_activity_as", {
    p_actor_id: claims.userId,
    p_actor_type: "admin",
    p_action: "admin.password_reset",
    p_ip_hash: meta.ipHash,
  });
  redirect(`${ADMIN_LOGIN_PATH}?reason=password_updated`);
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  const claims = await getAuthClaims();
  if (claims) {
    const meta = await requestMeta();
    await createServiceClient().rpc("admin_session_revoke", {
      p_admin_id: claims.userId,
      p_session_id: claims.sessionId,
    });
    await logSecurityEvent("admin_logout", meta, { actorId: claims.userId });
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`${ADMIN_LOGIN_PATH}?reason=signed_out`);
}
