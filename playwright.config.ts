import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    // Use a system-provided Chromium when available (e.g. sandboxed CI images
    // that pre-install browsers outside Playwright's registry).
    launchOptions: process.env.EARWORM_CHROMIUM
      ? { executablePath: process.env.EARWORM_CHROMIUM }
      : {},
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
