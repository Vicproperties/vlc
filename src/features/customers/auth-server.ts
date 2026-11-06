import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { emailHash } from "@/features/auth/crypto";
import type { RequestMeta } from "@/features/auth/request-meta";
import { logSecurityEvent } from "@/features/auth/security-log";
import { publicEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";
import { sendEmail } from "@/lib/email/send";
import { customerResetEmail, customerVerifyEmail } from "@/lib/email/templates";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Customer email links and the password-reset marker.
 *
 * Links point at our own pages (built from the configured site URL, never the request Host
 * header) and carry Supabase's hashed token. The page needs a click before the token is used,
 * so email link scanners cannot use it up. Staff accounts never receive customer emails.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function isStaffAccount(userId: string): Promise<boolean> {
  const { data } = await createServiceClient().from("admin_users").select("id").eq("id", userId).maybeSingle();
  return Boolean(data);
}

/** The customer account for an email, or null (also for staff and accounts without a profile). */
async function findCustomer(email: string) {
  const service = createServiceClient();
  const { data: userId } = await service.rpc("customer_id_for_email", { p_email: email });
  if (!userId) return null;
  const [{ data: profile }, staff] = await Promise.all([
    service.from("customer_profiles").select("full_name").eq("id", userId).maybeSingle(),
    isStaffAccount(userId),
  ]);
  if (!profile || staff) return null;
  const { data } = await service.auth.admin.getUserById(userId);
  if (!data.user) return null;
  return { id: userId, name: profile.full_name, confirmed: Boolean(data.user.email_confirmed_at) };
}

function siteLink(path: string, params: Record<string, string>) {
  const url = new URL(path, publicEnv().NEXT_PUBLIC_SITE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Sends the activation link to an unverified customer account. Does nothing for any other
 * address, so callers can always show the same message.
 */
export async function sendVerificationLink(
  email: string,
  meta: RequestMeta,
  opts: { next?: string; favourite?: string | null } = {},
): Promise<void> {
  const customer = await findCustomer(email);
  if (!customer || customer.confirmed) return;

  const { data, error } = await createServiceClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    await logSecurityEvent("email_send_failed", meta, {
      actorId: customer.id,
      metadata: { purpose: "customer_verify", reason: "generate_link_failed" },
    });
    return;
  }
  const params: Record<string, string> = { token_hash: data.properties.hashed_token };
  if (opts.next && opts.next !== "/account") params.next = opts.next;
  if (opts.favourite && UUID.test(opts.favourite)) params.favourite = opts.favourite;
  const sent = await sendEmail(
    email,
    customerVerifyEmail({ name: customer.name, link: siteLink("/account/verify", params) }),
  );
  if (!sent.ok) {
    await logSecurityEvent("email_send_failed", meta, {
      actorId: customer.id,
      metadata: { purpose: "customer_verify", reason: sent.reason },
    });
  }
}

/** Sends a password reset link to a customer account. Silent for staff and unknown addresses. */
export async function sendCustomerResetLink(email: string, meta: RequestMeta): Promise<void> {
  const customer = await findCustomer(email);
  await logSecurityEvent("customer_password_reset_requested", meta, {
    actorId: customer?.id,
    emailHash: emailHash(email),
    metadata: { matched: Boolean(customer) },
  });
  if (!customer) return;

  const { data, error } = await createServiceClient().auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) {
    await logSecurityEvent("email_send_failed", meta, {
      actorId: customer.id,
      metadata: { purpose: "customer_reset", reason: "generate_link_failed" },
    });
    return;
  }
  const link = siteLink("/account/reset-password", { token_hash: data.properties.hashed_token });
  const sent = await sendEmail(email, customerResetEmail({ name: customer.name, link }));
  if (!sent.ok) {
    await logSecurityEvent("email_send_failed", meta, {
      actorId: customer.id,
      metadata: { purpose: "customer_reset", reason: sent.reason },
    });
  }
}

// ---------------------------------------------------------------------------
// Password-reset marker: only the session created by a reset link may set a new password
// without the current one. Signed, http-only, 15 minutes, bound to that session.
// ---------------------------------------------------------------------------
const RESET_COOKIE = "vl_customer_reset";
const RESET_TTL_SECONDS = 15 * 60;

function sign(value: string): string {
  return createHmac("sha256", serverEnv("ADMIN_OTP_HMAC_SECRET")).update(`customer-reset:${value}`).digest("hex");
}

export function sessionIdFromToken(accessToken: string): string {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
    session_id?: string;
  };
  if (!payload.session_id) throw new Error("Auth session is missing a session id.");
  return payload.session_id;
}

export async function setResetMarker(sessionId: string) {
  const expires = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS;
  const value = `${sessionId}.${expires}`;
  (await cookies()).set(RESET_COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/account",
    maxAge: RESET_TTL_SECONDS,
  });
}

export async function hasResetMarker(sessionId: string): Promise<boolean> {
  const raw = (await cookies()).get(RESET_COOKIE)?.value ?? "";
  const [id, expires, mac] = raw.split(".");
  if (!id || !expires || !mac || id !== sessionId) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(`${id}.${expires}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function clearResetMarker() {
  (await cookies()).set(RESET_COOKIE, "", { path: "/account", maxAge: 0 });
}
