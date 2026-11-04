import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`next build && next start`)
 * so that production-only behaviour (headers, dev-page 404s) is verified.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    // Always start a fresh server so tests never run against a stale build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
