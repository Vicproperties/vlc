import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. Importing this module from a client component fails the build
 * (enforced by the `server-only` package). Never prefix these with NEXT_PUBLIC_.
 *
 * Values are validated lazily on first use, so features that are not yet configured
 * (e.g. email before Stage 4) do not prevent the app from building.
 */
const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(3),
  ADMIN_OTP_HMAC_SECRET: z.string().min(32, "ADMIN_OTP_HMAC_SECRET must be at least 32 characters"),
  TURNSTILE_SECRET_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof schema>;
export type ServerEnvKey = keyof ServerEnv;

/** Read a single server secret, throwing a clear error if it is missing or invalid. */
export function serverEnv<K extends ServerEnvKey>(key: K): ServerEnv[K] {
  const raw = process.env[key];
  const result = schema.shape[key].safeParse(raw === "" ? undefined : raw);
  if (!result.success) {
    throw new Error(`Server environment variable ${key} is missing or invalid.`);
  }
  return result.data as ServerEnv[K];
}
