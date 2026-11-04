import "server-only";
import type { Json } from "@/types/database";
import { createServiceClient } from "@/lib/supabase/service";
import type { RequestMeta } from "./request-meta";

export type SecurityEventType =
  | "admin_login_failed"
  | "admin_login_denied"
  | "admin_login_rate_limited"
  | "admin_otp_sent"
  | "admin_otp_failed"
  | "admin_otp_locked"
  | "admin_otp_rate_limited"
  | "admin_login_success"
  | "admin_logout"
  | "admin_session_expired"
  | "admin_password_reset_requested"
  | "admin_password_reset_rate_limited"
  | "admin_password_reset_link_invalid"
  | "admin_password_reset_completed"
  | "email_send_failed";

/**
 * Appends a security event. Logging must never break authentication, so failures are
 * reported to the server console (event type only) and swallowed.
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  meta: RequestMeta | null,
  details: { actorId?: string; emailHash?: string; metadata?: Record<string, Json> } = {},
): Promise<void> {
  try {
    const { error } = await createServiceClient().rpc("log_security_event", {
      p_event_type: eventType,
      p_actor_id: details.actorId,
      p_email_hash: details.emailHash,
      p_ip_hash: meta?.ipHash,
      p_user_agent: meta?.userAgent ?? undefined,
      p_metadata: details.metadata ?? {},
    });
    if (error) console.error(`[security-log] failed to record ${eventType}: ${error.code}`);
  } catch {
    console.error(`[security-log] failed to record ${eventType}`);
  }
}

/** Fixed-window rate limit. Fails closed: if the check cannot run, the request is refused. */
export async function withinRateLimit(
  key: string,
  [limit, windowSeconds]: readonly [number, number],
): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] check failed: ${error.code}`);
    return false;
  }
  return data === true;
}
