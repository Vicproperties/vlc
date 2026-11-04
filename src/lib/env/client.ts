import { z } from "zod";

/**
 * Public (browser-safe) configuration. Only NEXT_PUBLIC_* variables belong here.
 * Each variable is referenced explicitly so Next.js can inline it at build time.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_ADMIN_BASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof schema>;

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const result = schema.safeParse({
    NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000",
    NEXT_PUBLIC_ADMIN_BASE_URL:
      emptyToUndefined(process.env.NEXT_PUBLIC_ADMIN_BASE_URL) ?? "http://localhost:3000/admin",
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  });
  if (!result.success) {
    throw new Error(`Invalid public environment configuration: ${z.prettifyError(result.error)}`);
  }
  cached = result.data;
  return cached;
}
