import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Auth journeys use the DEVELOPMENT Supabase project (.env.local) for fixtures.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * End-to-end tests run against a production build (`next build && next start`)
 * so that production-only behaviour (headers, dev-page 404s) is verified.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Auth steps make several round trips to the remote development database.
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Dashboard journeys create accounts and data; run them once (desktop) rather than per device.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /admin-auth|admin-users|properties|public|enquiries|content|blog|account/,
    },
  ],
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    // Always start a fresh server so tests never run against a stale build.
    reuseExistingServer: false,
    timeout: 120_000,
    // Codes are injected by the tests; never send real email from automated runs.
    env: { EMAIL_TRANSPORT: "disabled" },
  },
});
