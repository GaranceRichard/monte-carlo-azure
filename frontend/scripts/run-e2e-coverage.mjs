import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  E2E_COVERAGE_ARTIFACT_PATH,
  coverageScopeFingerprint,
  loadE2ECoverageConfig,
} from "./e2e-coverage-config.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const config = loadE2ECoverageConfig();
const runId = crypto.randomUUID();
const startedAt = new Date().toISOString();

fs.rmSync(E2E_COVERAGE_ARTIFACT_PATH, { force: true });

const playwrightCli = path.join(
  frontendRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const playwright = spawnSync(
  process.execPath,
  [playwrightCli, "test", ...process.argv.slice(2)],
  {
    cwd: frontendRoot,
    env: {
      ...process.env,
      E2E_COVERAGE_RUN_ID: runId,
      E2E_COVERAGE_STARTED_AT: startedAt,
      E2E_COVERAGE_SCOPE_ID: config.scope.id,
      E2E_COVERAGE_SCOPE_FINGERPRINT: coverageScopeFingerprint(config.scope),
    },
    stdio: "inherit",
  },
);

if (playwright.error) {
  console.error(`Unable to start Playwright: ${playwright.error.message}`);
  process.exit(2);
}
if (playwright.status !== 0) {
  process.exit(playwright.status ?? 1);
}

const localPython = process.platform === "win32"
  ? path.join(repositoryRoot, ".venv", "Scripts", "python.exe")
  : path.join(repositoryRoot, ".venv", "bin", "python");
const pythonCommand = fs.existsSync(localPython)
  ? localPython
  : (process.env.PYTHON || "python");
const validation = spawnSync(
  pythonCommand,
  [
    path.join(repositoryRoot, "Scripts", "check_e2e_coverage.py"),
    "--artifact",
    E2E_COVERAGE_ARTIFACT_PATH,
    "--config",
    path.join(frontendRoot, "e2e-coverage.config.json"),
    "--run-id",
    runId,
    "--started-at",
    startedAt,
  ],
  {
    cwd: repositoryRoot,
    stdio: "inherit",
  },
);

if (validation.error) {
  console.error(`Unable to validate E2E coverage: ${validation.error.message}`);
  process.exit(2);
}
process.exit(validation.status ?? 1);
