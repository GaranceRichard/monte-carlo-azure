import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import {
  formatBackendLaunchError,
  missingBackendDependency,
  resolveBackendWebServer,
} from "./scripts/e2e-backend-web-server.mjs";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || "4173");
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER !== "0";
const configuredWorkers = process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : undefined;
const backendWebServer = resolveBackendWebServer();
const missingBackend = missingBackendDependency(backendWebServer);

if (missingBackend) {
  throw new Error(formatBackendLaunchError(backendWebServer, missingBackend));
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: Number.isFinite(configuredWorkers) ? configuredWorkers : undefined,
  reporter: [["list"], ["./scripts/playwright-execution-reporter.mjs"]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: backendWebServer.command,
      cwd: backendWebServer.cwd,
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      cwd: frontendRoot,
      port: webPort,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});
