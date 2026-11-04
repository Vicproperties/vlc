import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Integration tests run against the DEVELOPMENT Supabase project (.env.local).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
