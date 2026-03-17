import process from "node:process";
import { defineConfig } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || "4173");
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER !== "0";
const configuredWorkers = process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: Number.isFinite(configuredWorkers) ? configuredWorkers : undefined,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    env: {
      ...process.env,
      VITE_API_BASE: process.env.VITE_API_BASE || "http://127.0.0.1:8000",
    },
    port: webPort,
    reuseExistingServer,
    timeout: 60_000,
  },
});
