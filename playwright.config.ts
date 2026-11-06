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
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    // Visitors in tests have already answered the cookie question ("essential only"), so the
    // fixed cookie bar never covers what a test clicks. cookies.spec starts without it.
    storageState: {
      cookies: [
        {
          name: "vl_consent",
          value: "1.0.00000000-0000-4000-8000-000000000000",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /marketing\.spec/ },
    // The marketing journey switches a site-wide banner and pop-up on for a minute, which would
    // cover pages in tests running alongside it: it runs alone, after everything else.
    {
      name: "desktop-marketing",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /marketing\.spec/,
      dependencies: ["desktop", "mobile"],
    },
    // Dashboard journeys create accounts and data; run them once (desktop) rather than per device.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore:
        /admin-auth|admin-users|marketing|cookies|blog-engagement|properties|public|enquiries|content|blog|account/,
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
