import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { otpEmail } from "@/lib/email/templates";
import { OTP_MAX_SENDS_PER_LOGIN, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_SECONDS } from "./constants";
import { generateOtp, otpHash } from "./crypto";
import { logSecurityEvent } from "./security-log";
import type { RequestMeta } from "./request-meta";

export type IssueResult = "sent" | "cooldown" | "limit" | "invalid_session" | "send_failed";

/**
 * Creates a fresh code for the login session and emails it. Only the session-bound HMAC is
 * stored; the plain code exists only in memory and in the email.
 */
export async function issueAndSendCode(params: {
  sessionId: string;
  adminId: string;
  email: string;
  name: string;
  meta: RequestMeta;
}): Promise<IssueResult> {
  const code = generateOtp();
  const { data, error } = await createServiceClient().rpc("admin_otp_issue", {
    p_session_id: params.sessionId,
    p_code_hash: otpHash(params.sessionId, code),
    p_ttl_seconds: OTP_TTL_SECONDS,
    p_cooldown_seconds: OTP_RESEND_COOLDOWN_SECONDS,
    p_max_per_session: OTP_MAX_SENDS_PER_LOGIN,
  });
  if (error) throw new Error("Unable to create a sign-in code.");
  if (data !== "issued") return data as IssueResult;

  const sent = await sendEmail(params.email, otpEmail({ name: params.name, code, minutes: OTP_TTL_SECONDS / 60 }));
  if (!sent.ok) {
    await logSecurityEvent("email_send_failed", params.meta, {
      actorId: params.adminId,
      metadata: { purpose: "admin_otp", reason: sent.reason },
    });
    return "send_failed";
  }
  await logSecurityEvent("admin_otp_sent", params.meta, { actorId: params.adminId });
  return "sent";
}
