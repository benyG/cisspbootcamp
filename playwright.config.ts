import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// Escape hatch for CI images that ship their own Chromium instead of the one
// `playwright install` would download.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/**
 * The prospect journey is mobile-first (CADRAGE §3), so the reference project
 * is a 360 px handset rather than a desktop viewport.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The journey walks four pages with server actions in between: 30 s per
  // test is too tight on a cold CI runner.
  timeout: 90_000,
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        launchOptions: { executablePath },
      },
    },
  ],
  webServer: {
    // CI builds in its own step (see .github/workflows/ci.yml) so a build
    // failure is reported as such, not as a Playwright timeout.
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
