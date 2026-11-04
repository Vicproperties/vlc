// Fails if any server-only variable name or value appears in the client bundle (.next/static).
// Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SERVER_ONLY = ["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "ADMIN_OTP_HMAC_SECRET", "TURNSTILE_SECRET_KEY"];

const needles = [
  ...SERVER_ONLY,
  ...SERVER_ONLY.map((k) => process.env[k]).filter((v) => typeof v === "string" && v.length >= 8),
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const root = ".next/static";
let files;
try {
  files = walk(root);
} catch {
  console.error(`No ${root} directory. Run "npm run build" first.`);
  process.exit(2);
}

const hits = [];
for (const file of files) {
  if (!/\.(js|css|json|map)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const needle of needles) if (content.includes(needle)) hits.push({ file, needle: needle.slice(0, 24) });
}

if (hits.length) {
  console.error("Server-only values found in client bundle:");
  for (const h of hits) console.error(`  ${h.needle} -> ${h.file}`);
  process.exit(1);
}
console.log(`OK: scanned ${files.length} client files, no server-only names or values found.`);
