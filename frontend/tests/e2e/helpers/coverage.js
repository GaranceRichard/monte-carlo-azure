import istanbulCoverage from "istanbul-lib-coverage";
import v8toIstanbul from "v8-to-istanbul";

let inlineScriptCounter = 0;

export async function summarizeCoverageIstanbul(entries) {
  const { createCoverageMap } = istanbulCoverage;
  const map = createCoverageMap({});
  const toStart = (r) => (typeof r.start === "number" ? r.start : r.startOffset);
  const toEnd = (r) => (typeof r.end === "number" ? r.end : r.endOffset);

  for (const entry of entries) {
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
      map.merge(converter.toIstanbul());
    } catch {
      // Ignore malformed/anonymous scripts that cannot be converted.
    }
  }

  const summary = map.getCoverageSummary().toJSON();
  return {
    files: map.files().length,
    statements: summary.statements,
    branches: summary.branches,
    functions: summary.functions,
    lines: summary.lines,
  };
}
