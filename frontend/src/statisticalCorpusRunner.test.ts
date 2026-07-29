import corpusDocument from "../../contracts/statistical-reference-corpus-v1.0.json";
import validationProbes from "../../contracts/statistical-validation-probes-v1.0.json";
import { describe, expect, it, vi } from "vitest";
import type { SimulationResult } from "./domain/simulation";
import {
  canonicalizeTypeScriptResult,
  runTypeScriptValidationProbes,
  runTypeScriptCorpus,
} from "./statisticalCorpusRunner";
import type {
  ReferenceCase,
  StatisticalCorpus,
} from "./statisticalCorpusRunner";

const corpus = corpusDocument as unknown as StatisticalCorpus;

type EngineCaseReport = {
  id: string;
  status: string;
  result?: Record<string, unknown>;
  error?: { type: string; message: string };
};

describe("shared statistical corpus TypeScript runner", () => {
  it("executes the same 1.0 corpus with mca-prng-v1 and canonical output", () => {
    const report = runTypeScriptCorpus(corpus, []);
    const cases = report.cases as EngineCaseReport[];
    const expectedById = new Map(
      corpusDocument.cases.map((referenceCase) => [
        referenceCase.id,
        referenceCase.expected_result,
      ]),
    );
    const matching = cases.filter((caseReport) => (
      JSON.stringify(caseReport.result) === JSON.stringify(expectedById.get(caseReport.id))
    ));

    expect(report).toMatchObject({
      engine: "typescript",
      corpus_id: "mca-statistical-reference-corpus",
      schema_version: "1.0",
      prng_contract: "mca-prng-v1",
      status: "completed",
    });
    expect(cases).toHaveLength(15);
    expect(matching).toHaveLength(13);
    expect(
      cases
        .filter((caseReport) => !matching.includes(caseReport))
        .map((caseReport) => caseReport.id),
    ).toEqual([
      "histogram-aggregated-contiguous-101",
      "histogram-aggregated-discontinuous",
    ]);
    expect(cases.find((caseReport) => caseReport.id === "items-zero-weeks-excluded")?.result)
      .toMatchObject({
        result_kind: "items",
        risk_score: 0.6667,
        seed: 0,
      });
    expect(cases.find((caseReport) => caseReport.id === "weeks-total-censorship")?.result)
      .not.toHaveProperty("risk_score");
  });

  it("refuses execution when the shared schema validator reports an issue", () => {
    const executeCase = vi.fn();

    const report = runTypeScriptCorpus(corpus, ["schema /cases/0 is invalid"], executeCase);

    expect(report).toEqual({
      engine: "typescript",
      corpus_id: "mca-statistical-reference-corpus",
      schema_version: "1.0",
      prng_contract: "mca-prng-v1",
      status: "invalid_corpus",
      diagnostics: ["schema /cases/0 is invalid"],
      cases: [],
    });
    expect(executeCase).not.toHaveBeenCalled();
  });

  it("applies every shared positive and negative normalized-input probe", () => {
    const report = runTypeScriptValidationProbes(validationProbes);
    const expected = new Map(
      validationProbes.cases.map((probe) => [probe.id, probe.accepted]),
    );

    expect(report).toMatchObject({
      engine: "typescript",
      schema_version: "1.0",
      normative_contract: "STD-STAT-001",
      status: "completed",
    });
    expect(report.cases).toEqual(
      validationProbes.cases.map((probe) => ({
        id: probe.id,
        accepted: expected.get(probe.id),
      })),
    );
  });

  it("reports Error and non-Error engine failures per case", () => {
    const candidate = {
      ...corpus,
      cases: corpus.cases.slice(0, 2),
    };
    const executeCase = vi.fn((referenceCase: ReferenceCase) => {
      if (referenceCase.id === candidate.cases[0]?.id) {
        throw new RangeError("simulated TypeScript failure");
      }
      throw "non-Error failure";
    });

    const report = runTypeScriptCorpus(candidate, [], executeCase);

    expect(report.status).toBe("engine_error");
    expect(report.cases).toEqual([
      {
        id: candidate.cases[0]?.id,
        status: "engine_error",
        error: { type: "RangeError", message: "simulated TypeScript failure" },
      },
      {
        id: candidate.cases[1]?.id,
        status: "engine_error",
        error: { type: "string", message: "non-Error failure" },
      },
    ]);
  });

  it("preserves absent optional engine fields instead of fabricating values", () => {
    const result = {
      resultKind: "items",
      samplesCount: 6,
      seed: 0,
      resultPercentiles: {},
      resultDistribution: [],
      throughputReliability: {
        cv: 0,
        iqrRatio: 0,
        slopeNorm: 0,
        label: "incertain",
        samplesCount: 6,
      },
    } as unknown as SimulationResult;

    expect(canonicalizeTypeScriptResult(result)).toEqual({
      result_kind: "items",
      result_percentiles: {},
      result_distribution: [],
      samples_count: 6,
      throughput_reliability: {
        cv: 0,
        iqr_ratio: 0,
        slope_norm: 0,
        label: "incertain",
        samples_count: 6,
      },
      seed: 0,
    });
    expect(() => canonicalizeTypeScriptResult({
      ...result,
      throughputReliability: undefined,
    } as unknown as SimulationResult)).toThrow("throughput_reliability");
  });
});
