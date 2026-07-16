import istanbulCoverage from "istanbul-lib-coverage";
import v8toIstanbul from "v8-to-istanbul";
import {
  isExcludedCoveragePath,
  loadE2ECoverageConfig,
  normalizeCoverageMetric,
} from "../../../scripts/e2e-coverage-config.mjs";

let inlineScriptCounter = 0;
const coverageScope = loadE2ECoverageConfig().scope;

export async function summarizeCoverageIstanbul(entries) {
  const { createCoverageMap } = istanbulCoverage;
  const map = createCoverageMap({});
  const toStart = (r) => (typeof r.start === "number" ? r.start : r.startOffset);
  const toEnd = (r) => (typeof r.end === "number" ? r.end : r.endOffset);

  for (const entry of entries) {
    const url = typeof entry?.url === "string" ? entry.url : "";
    if (isExcludedCoveragePath(url, coverageScope)) {
      continue;
    }

    let sourceText = typeof entry?.text === "string" ? entry.text : "";
    if (!sourceText && typeof entry?.url === "string" && entry.url.startsWith("http")) {
      try {
        const resp = await fetch(entry.url);
        if (resp.ok) sourceText = await resp.text();
      } catch {
        // Ignore scripts that cannot be fetched.
      }
    }
    if (!sourceText) continue;

    const v8Functions = Array.isArray(entry?.functions) && entry.functions.length > 0
      ? entry.functions
      : [{
          functionName: "(root)",
          ranges: Array.isArray(entry?.ranges)
            ? entry.ranges
                .map((r) => ({
                  startOffset: toStart(r),
                  endOffset: toEnd(r),
                  count: typeof r.count === "number" ? r.count : 0,
                }))
                .filter((r) => Number.isFinite(r.startOffset) && Number.isFinite(r.endOffset))
            : [],
          isBlockCoverage: true,
        }];

    if (!v8Functions[0].ranges.length) continue;
    try {
      const syntheticScriptPath = `inline-script-${inlineScriptCounter++}.js`;
      const converter = v8toIstanbul(syntheticScriptPath, 0, { source: sourceText });
      await converter.load();
      converter.applyCoverage(v8Functions);
      const convertedMap = createCoverageMap(converter.toIstanbul());
      for (const filePath of convertedMap.files()) {
        if (isExcludedCoveragePath(filePath, coverageScope)) {
          continue;
        }
        map.addFileCoverage(convertedMap.fileCoverageFor(filePath));
      }
    } catch {
      // Ignore malformed/anonymous scripts that cannot be converted.
    }
  }

  const summary = map.getCoverageSummary().toJSON();
  const byFile = map.files()
    .map((filePath) => {
      const fileSummary = map.fileCoverageFor(filePath).toSummary().toJSON();
      return {
        file: filePath,
        statements: normalizeCoverageMetric(fileSummary.statements),
        branches: normalizeCoverageMetric(fileSummary.branches),
        functions: normalizeCoverageMetric(fileSummary.functions),
        lines: normalizeCoverageMetric(fileSummary.lines),
      };
    })
    .sort((a, b) => {
      if (a.functions.pct !== b.functions.pct) return a.functions.pct - b.functions.pct;
      if (a.functions.total !== b.functions.total) return b.functions.total - a.functions.total;
      return a.file.localeCompare(b.file);
    });
  return {
    files: map.files().length,
    statements: normalizeCoverageMetric(summary.statements),
    branches: normalizeCoverageMetric(summary.branches),
    functions: normalizeCoverageMetric(summary.functions),
    lines: normalizeCoverageMetric(summary.lines),
    byFile,
  };
}
