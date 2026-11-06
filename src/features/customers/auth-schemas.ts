import { z } from "zod";

/**
 * Customer account forms. Customers choose their own passwords; staff accounts have a stricter
 * policy (12+ characters, separate sign-in with an emailed code).
 */
export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt limit used by Supabase Auth

/** Per-IP and per-email limits (Postgres fixed windows): [requests, seconds]. */
export const CUSTOMER_RATE_LIMITS = {
  registerPerIp: [10, 60 * 60],
  loginPerIp: [30, 15 * 60],
  loginPerEmail: [8, 15 * 60],
  emailLinkPerIp: [10, 60 * 60],
  emailLinkPerEmail: [3, 60 * 60],
  linkConfirmPerIp: [20, 60 * 60],
  changePasswordPerUser: [5, 15 * 60],
} as const satisfies Record<string, readonly [number, number]>;

export const customerEmail = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "Enter a valid email address.")
  .pipe(z.email({ error: "Enter a valid email address." }));

export const customerPassword = z
  .string({ error: "Enter a password." })
  .min(CUSTOMER_PASSWORD_MIN_LENGTH, `Use at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, {
    error: "Use at most 72 characters.",
  })
  .refine((value) => value.trim().length === value.length, {
    error: "The password cannot start or end with a space.",
  })
  .refine((value) => new Set(value).size >= 4, { error: "Use a less repetitive password." });

const matching = <T extends { password: string; confirm: string }>(data: T) => data.password === data.confirm;
const mismatch = { path: ["confirm"], error: "The passwords do not match." };

export const registerSchema = z
  .object({
    full_name: z
      .string({ error: "Enter your full name." })
      .trim()
      .min(2, "Enter your full name.")
      .max(120, "Use 120 characters or fewer."),
    email: customerEmail,
    password: customerPassword,
    confirm: z.string({ error: "Confirm your password." }),
  })
  .refine(matching, mismatch);

export const customerLoginSchema = z.object({
  email: customerEmail,
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(256),
});

export const newCustomerPasswordSchema = z
  .object({ password: customerPassword, confirm: z.string({ error: "Confirm the new password." }) })
  .refine(matching, mismatch);

export const changePasswordSchema = z
  .object({
    current: z.string({ error: "Enter your current password." }).min(1, "Enter your current password.").max(256),
    password: customerPassword,
    confirm: z.string({ error: "Confirm the new password." }),
  })
  .refine(matching, mismatch);

/** Supabase's hashed token from an emailed link. */
export const TOKEN_HASH = /^[A-Za-z0-9_-]{10,200}$/;
