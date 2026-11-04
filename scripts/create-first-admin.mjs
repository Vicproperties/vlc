#!/usr/bin/env node
/**
 * Creates the FIRST super administrator. Run once per environment:
 *
 *   npm run admin:bootstrap -- --email owner@example.com --name "Full Name"
 *
 * The account is created without a password. The owner then opens /admin/forgot-password,
 * enters the same email and sets a password from the emailed link, so no password is ever
 * typed into a terminal, a chat or a log.
 *
 * Refuses to run if any super administrator already exists: further admins are invited
 * from the dashboard (Admin Users).
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the environment instead.
}

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" } },
  strict: true,
});

const email = values.email?.trim().toLowerCase() ?? "";
const name = values.name?.trim() ?? "";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail("Provide a valid --email.");
if (name.length < 2 || name.length > 120) fail('Provide --name "Full Name" (2–120 characters).');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local).");

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const existing = await supabase
  .from("admin_users")
  .select("id", { count: "exact", head: true })
  .eq("role", "super_admin");
if (existing.error) fail(`Could not check existing administrators (${existing.error.code}).`);
if ((existing.count ?? 0) > 0) fail("A super administrator already exists. Invite further admins from the dashboard.");

let userId;
const created = await supabase.auth.admin.createUser({ email, email_confirm: true });
if (created.error) {
  if (created.error.code !== "email_exists") fail(`Could not create the account (${created.error.code}).`);
  userId = await findUserId(email);
} else {
  userId = created.data.user.id;
}

const inserted = await supabase.from("admin_users").insert({ id: userId, email, full_name: name, role: "super_admin" });
if (inserted.error) fail(`Could not register the administrator (${inserted.error.code}).`);

await supabase.rpc("log_security_event", {
  p_event_type: "admin_bootstrap_created",
  p_actor_id: userId,
  p_metadata: { role: "super_admin" },
});

const adminBase = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || "http://localhost:3000/admin";
console.log(`Super administrator created for ${email}.`);
console.log(`Next: open ${adminBase}/forgot-password, enter this email, and set a password from the emailed link.`);

async function findUserId(target) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not look up the existing account (${error.code}).`);
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  fail("The account exists but could not be found.");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
