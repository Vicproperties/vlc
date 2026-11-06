import "server-only";
import { publicEnv } from "@/lib/env/client";
import { sendEmail } from "@/lib/email/send";
import { passwordLinkEmail } from "@/lib/email/templates";
import { createServiceClient } from "@/lib/supabase/service";
import { emailHash } from "./crypto";
import { logSecurityEvent } from "./security-log";
import type { RequestMeta } from "./request-meta";

/**
 * Emails a password link to an ACTIVE admin. Does nothing (silently) for any other address,
 * so the caller's response never reveals whether an account exists. Returns whether an email
 * was handed to the provider (used only by the super-admin invite screen).
 *
 * The link points at our own confirmation page (built from the configured admin URL, never
 * from the request Host header) carrying Supabase's hashed token. The page requires a click
 * before the token is used, so email link scanners cannot consume it.
 */
export async function sendAdminPasswordLink(
  email: string,
  meta: RequestMeta | null,
  kind: "reset" | "invite",
): Promise<boolean> {
  const service = createServiceClient();
  const { data: admin } = await service
    .from("admin_users")
    .select("id, full_name, is_active")
    .eq("email", email)
    .maybeSingle();

  if (!admin?.is_active) {
    await logSecurityEvent("admin_password_reset_requested", meta, {
      emailHash: emailHash(email),
      metadata: { matched: false },
    });
    return false;
  }

  const { data, error } = await service.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) {
    await logSecurityEvent("email_send_failed", meta, {
      actorId: admin.id,
      metadata: { purpose: `admin_${kind}`, reason: "generate_link_failed" },
    });
    return false;
  }

  const link = `${publicEnv().NEXT_PUBLIC_ADMIN_BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(
    data.properties.hashed_token,
  )}`;
  const sent = await sendEmail(email, passwordLinkEmail({ name: admin.full_name, link, kind }));
  await logSecurityEvent(sent.ok ? "admin_password_reset_requested" : "email_send_failed", meta, {
    actorId: admin.id,
    metadata: sent.ok ? { matched: true, kind } : { purpose: `admin_${kind}`, reason: sent.reason },
  });
  return sent.ok;
}
