import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke suite (brief: "Vitest + RTL + MSW + Playwright"). Runs against an already
 * running stack: the frontend (PLAYWRIGHT_BASE_URL, default http://localhost:3000) talking to the
 * backend it is configured for, plus the Trigger.dev worker for that backend. It does not start
 * servers; `webServer` below only reuses a frontend dev server if one is listening.
 *
 * Auth: @clerk/testing mints a testing token (global setup) and signs the reviewer account in with a
 * Clerk sign-in ticket created through the Backend API, so no password is needed. Requires
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY (read from .env.local / .env.e2e.local /
 * the environment) and E2E_CLERK_USER_EMAIL (the reviewer account). One test sends a real message,
 * which costs one OpenRouter free-tier request; it accepts a completed OR a failed turn, because the
 * free router's daily cap makes failure the normal outcome on a busy day.
 */
for (const file of [".env.local", ".env.e2e.local"]) {
  const full = path.resolve(__dirname, file);
  if (!existsSync(full)) continue;
  for (const line of readFileSync(full, "utf8").split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2] ?? "";
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]!] === undefined) process.env[m[1]!] = v;
  }
}
if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const STORAGE_STATE = path.resolve(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global.setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 150_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1470, height: 840 }, storageState: STORAGE_STATE },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE },
    },
  ],
  webServer: baseURL.includes("localhost")
    ? { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
