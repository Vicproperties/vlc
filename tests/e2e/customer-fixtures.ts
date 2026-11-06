import { randomBytes } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { RUN_ID, serviceClient, url } from "../integration/helpers";

/**
 * Customer accounts for e2e. Real customers sign in with Google, which cannot be automated, so
 * the test creates an email/password user (rls-test- prefix, removed by cleanup), gives it a
 * customer profile as the OAuth callback would, and signs in through @supabase/ssr to obtain the
 * exact session cookies the app expects. Everything after that runs through the real UI.
 */
export interface TestCustomer {
  id: string;
  email: string;
  password: string;
  name: string;
}

export async function createTestCustomer(label: string): Promise<TestCustomer> {
  const service = serviceClient();
  const email = `rls-test-e2e-${label}-${RUN_ID}@example.com`;
  const password = `E2e ${randomBytes(12).toString("hex")}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const name = `Customer ${label}`;
  const profile = await service.from("customer_profiles").insert({ id: data.user.id, full_name: name });
  if (profile.error) throw new Error(`customer_profiles: ${profile.error.message}`);
  return { id: data.user.id, email, password, name };
}

export async function signInAsCustomer(context: BrowserContext, customer: TestCustomer, baseURL: string) {
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(url(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => {
        for (const c of cookies) {
          const i = jar.findIndex((x) => x.name === c.name);
          if (i >= 0) jar.splice(i, 1);
          if (c.value) jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: customer.email, password: customer.password });
  if (error) throw new Error(`customer sign-in: ${error.message}`);
  await context.addCookies(jar.map((c) => ({ ...c, url: baseURL, sameSite: "Lax" as const })));
}
