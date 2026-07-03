import process from "node:process";
import { defineConfig } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || "4173");
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER !== "0";
const configuredWorkers = process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : undefined;
const pythonCommand = process.platform === "win32"
  ? "..\\.venv\\Scripts\\python.exe"
  : "python";

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
  webServer: [
    {
      command: `${pythonCommand} ../run_app.py --host 127.0.0.1 --port 8000 --no-browser`,
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      port: webPort,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});
