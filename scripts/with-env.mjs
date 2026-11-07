// Run a command with variables from .env.local, without exposing secrets.
//
//   node scripts/with-env.mjs supabase db push --db-url {SUPABASE_DB_URL}
//
// - `{NAME}` in an argument is replaced with the variable's value.
// - Every secret value is redacted from stdout/stderr before it is printed.
// - Never `source` .env files in a shell: malformed lines get echoed back as errors.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const file = process.env.ENV_FILE ?? ".env.local";
if (!existsSync(file)) {
  console.error(`${file} not found.`);
  process.exit(2);
}
process.loadEnvFile(file);

const SECRET_NAMES = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_LIVE_DB_URL",
  "SUPABASE_ACCESS_TOKEN",
  "RESEND_API_KEY",
  "ADMIN_OTP_HMAC_SECRET",
  "TURNSTILE_SECRET_KEY",
];

const secrets = SECRET_NAMES.map((name) => process.env[name])
  .filter((v) => typeof v === "string" && v.length >= 8)
  .flatMap((v) => {
    // Also redact the password segment of connection strings on its own.
    const pw = v.match(/^postgres(?:ql)?:\/\/[^:]+:([^@]+)@/)?.[1];
    return pw ? [v, pw, decodeURIComponent(pw)] : [v];
  })
  .sort((a, b) => b.length - a.length);

function redact(text) {
  let out = text;
  for (const s of secrets) out = out.split(s).join("[redacted]");
  return out.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "postgresql://[redacted]");
}

const [cmd, ...rawArgs] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(2);
}
const args = rawArgs.map((a) => a.replace(/\{([A-Z_]+)\}/g, (_, n) => process.env[n] ?? ""));

// Resolve the Supabase CLI's native binary so no shell is involved (a shell could
// reinterpret characters such as % in connection strings).
function resolveSupabaseBinary() {
  const platformPkg = {
    win32: "@supabase/cli-windows-x64/bin/supabase.exe",
    darwin: `@supabase/cli-darwin-${process.arch}/bin/supabase`,
    linux: `@supabase/cli-linux-${process.arch}/bin/supabase`,
  }[process.platform];
  const candidate = platformPkg ? `node_modules/${platformPkg}` : null;
  return candidate && existsSync(candidate) ? candidate : null;
}

const supabaseBin = cmd === "supabase" ? resolveSupabaseBinary() : null;
if (cmd === "supabase" && !supabaseBin) {
  console.error("Supabase CLI binary not found. Run npm install.");
  process.exit(2);
}
const bin = supabaseBin ?? cmd;

const child = spawn(bin, args, { env: process.env, shell: false });
child.stdout.on("data", (d) => process.stdout.write(redact(d.toString())));
child.stderr.on("data", (d) => process.stderr.write(redact(d.toString())));
child.on("close", (code) => process.exit(code ?? 1));
