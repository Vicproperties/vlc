import { randomBytes } from "node:crypto";
import { RUN_ID, serviceClient, sql } from "../integration/helpers";

/**
 * Customer accounts for e2e. Emails use the `rls-test-` prefix so the shared cleanup removes
 * them. The app runs with EMAIL_TRANSPORT=disabled, so tests obtain the emailed link tokens
 * directly from Supabase (the same tokens the emails would carry).
 */
export interface TestCustomer {
  id: string;
  email: string;
  password: string;
  name: string;
}

export function customerEmail(label: string): string {
  return `rls-test-e2e-${label}-${RUN_ID}@example.com`;
}

export function customerPassword(): string {
  return `Harbour ${randomBytes(6).toString("hex")}`;
}

/** An already verified customer (as if registered and activated through the site). */
export async function createTestCustomer(label: string): Promise<TestCustomer> {
  const service = serviceClient();
  const email = customerEmail(label);
  const password = customerPassword();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const name = `Customer ${label}`;
  const profile = await service.from("customer_profiles").insert({ id: data.user.id, full_name: name });
  if (profile.error) throw new Error(`customer_profiles: ${profile.error.message}`);
  return { id: data.user.id, email, password, name };
}

/** The token an activation or reset email would carry. */
export async function emailLinkToken(email: string, type: "magiclink" | "recovery"): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.generateLink({ type, email });
  if (error || !data.properties?.hashed_token) throw new Error(`generateLink: ${error?.message}`);
  return data.properties.hashed_token;
}

export async function resetCustomerRateLimits() {
  await sql("delete from private.rate_limits where key like 'customer-%'");
}
