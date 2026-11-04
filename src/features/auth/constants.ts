/**
 * Admin authentication limits. Database-side limits (5 wrong codes per login, 30-minute idle
 * timeout, 30-minute window to complete the code step) live in migration 0014 / 0002.
 */
export const ADMIN_SESSION_TTL = "12 hours";
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_LOGIN = 5;

export const PASSWORD_MIN_LENGTH = 12;
/** bcrypt (used by Supabase Auth) ignores bytes beyond 72. */
export const PASSWORD_MAX_LENGTH = 72;

/** Fixed-window rate limits: [max hits, window seconds]. */
export const RATE_LIMITS = {
  loginPerIp: [20, 15 * 60],
  loginPerEmail: [5, 15 * 60],
  otpVerifyPerSession: [10, 15 * 60],
  otpResendPerSession: [6, 30 * 60],
  forgotPerIp: [10, 60 * 60],
  forgotPerEmail: [3, 60 * 60],
  resetPerIp: [10, 60 * 60],
} as const satisfies Record<string, readonly [number, number]>;

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_VERIFY_PATH = "/admin/verify";
export const ADMIN_HOME_PATH = "/admin";

/** Paths under /admin reachable without a verified admin session. */
export const ADMIN_PUBLIC_PATHS = [
  "/admin/login",
  "/admin/verify",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/auth/confirm",
] as const;
