import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-base-path",
  outputDir: "test-results-base-path",
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-base-path" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun --bun next dev --port 3101",
    env: { RPC4NEXT_BASE_PATH_FIXTURE: "1", RPC_ORIGIN: "http://127.0.0.1:3101/docs" },
    url: "http://127.0.0.1:3101/docs",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
