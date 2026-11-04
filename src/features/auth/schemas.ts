import { z } from "zod";
import { OTP_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./constants";

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(254, "Enter a valid email address.")
  .pipe(z.email({ error: "Enter a valid email address." }));

export const loginSchema = z.object({
  email,
  // Length is checked by Supabase; only reject absurd input here.
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(256),
});

export const otpSchema = z.object({
  code: z
    .string({ error: "Enter the 6-digit code." })
    .transform((value) => value.replace(/\s|-/g, ""))
    .pipe(z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), "Enter the 6-digit code from the email.")),
});

export const forgotPasswordSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: z
      .string({ error: "Enter a new password." })
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
      .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_LENGTH, {
        error: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
      })
      .refine((value) => value.trim().length === value.length, {
        error: "The password cannot start or end with a space.",
      })
      .refine((value) => new Set(value).size >= 6, {
        error: "Use a less repetitive password.",
      }),
    confirm: z.string({ error: "Confirm the new password." }),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    error: "The passwords do not match.",
  });

/** Turns a ZodError into `{ field: firstMessage }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Shape returned by every auth Server Action to its form. */
export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so the email field keeps its value after a failed attempt (never the password). */
  email?: string;
}

export const initialAuthFormState: AuthFormState = { status: "idle" };
