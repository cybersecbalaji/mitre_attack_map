import { defineConfig, devices } from "@playwright/test"
import path from "path"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "line",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    colorScheme: "dark",
    actionTimeout: 45000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Use a dedicated port (3001) so it never conflicts with dev server on 3000
    command: `npx next dev --port 3001`,
    cwd: path.join(__dirname),
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
