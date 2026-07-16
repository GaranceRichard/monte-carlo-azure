import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const E2E_COVERAGE_CONFIG_PATH = path.join(frontendRoot, "e2e-coverage.config.json");
export const E2E_COVERAGE_ARTIFACT_PATH = path.join(
  frontendRoot,
  "coverage",
  "e2e-coverage-summary.json",
);

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function loadE2ECoverageConfig() {
  return JSON.parse(fs.readFileSync(E2E_COVERAGE_CONFIG_PATH, "utf8"));
}

export function coverageScopeFingerprint(scope) {
  return crypto.createHash("sha256").update(canonicalJson(scope)).digest("hex");
}

export function isIncludedCoverageUrl(rawUrl, scope) {
  try {
    const url = new URL(rawUrl);
    return url.pathname.startsWith(scope.urlPathPrefix)
      && !scope.excludedPathSuffixes.some((suffix) => url.pathname.endsWith(suffix));
  } catch {
    return false;
  }
}

export function isExcludedCoveragePath(filePath, scope) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  return scope.excludedPathSuffixes.some(
    (suffix) => normalized.endsWith(suffix) || normalized.includes(suffix),
  );
}

export function normalizeCoverageMetric(metric) {
  const normalized = {
    total: metric.total,
    covered: metric.covered,
    skipped: metric.skipped,
    pct: metric.pct,
  };
  if (
    normalized.total === 0
    && normalized.covered === 0
    && normalized.skipped === 0
  ) {
    normalized.pct = 100;
  }
  return normalized;
}
