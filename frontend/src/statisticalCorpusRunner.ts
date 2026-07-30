import { createSeededSampleIndexDrawPort } from "./adapters/seededSampleIndexDrawPort";
import { createSimulationCommandFromNormalizedInput } from "./domain/simulation";
import type { SimulationResult } from "./domain/simulation";
import { createSimulationSeed } from "./domain/simulationValueObjects";
import { simulateMonteCarloLocal } from "./utils/simulation";

type CorpusInput = {
  throughput_samples: readonly number[];
  include_zero_weeks: boolean;
  mode: "backlog_to_weeks" | "weeks_to_items";
  backlog_size?: number;
  target_weeks?: number;
  n_sims: number;
};

export type ReferenceCase = {
  id: string;
  input: CorpusInput;
  seed: number;
};

export type StatisticalCorpus = {
  corpus_id: string;
  schema_version: string;
  normative_contract: {
    id: string;
    version: string;
  };
  prng_contract: { id: string };
  cases: readonly ReferenceCase[];
};

export type CanonicalResult = Record<string, unknown>;
export type TypeScriptCaseExecutor = (referenceCase: ReferenceCase) => CanonicalResult;

export type ValidationProbeDocument = {
  schema_version: string;
  normative_contract: string;
  cases: readonly {
    id: string;
    input: unknown;
    seed: unknown;
    accepted: boolean;
  }[];
};

export function canonicalizeTypeScriptResult(result: SimulationResult): CanonicalResult {
  const canonical: CanonicalResult = {
    result_kind: result.resultKind,
    result_percentiles: result.resultPercentiles,
  };
  if (result.riskScore !== undefined) {
    canonical.risk_score = result.riskScore;
  }
  canonical.result_distribution = result.resultDistribution;
  if (result.completionSummary !== undefined) {
    canonical.completion_summary = {
      completed_count: result.completionSummary.completedCount,
      censored_count: result.completionSummary.censoredCount,
      censored_rate: result.completionSummary.censoredRate,
      horizon_weeks: result.completionSummary.horizonWeeks,
    };
  }
  canonical.samples_count = result.samplesCount;
  if (result.throughputReliability === undefined) {
    throw new Error("throughput_reliability est requis dans la reponse canonique.");
  }
  canonical.throughput_reliability = {
    cv: result.throughputReliability.cv,
    iqr_ratio: result.throughputReliability.iqrRatio,
    slope_norm: result.throughputReliability.slopeNorm,
    label: result.throughputReliability.label,
    samples_count: result.throughputReliability.samplesCount,
  };
  canonical.seed = result.seed;
  return canonical;
}

export function executeTypeScriptCase(referenceCase: ReferenceCase): CanonicalResult {
  const command = createSimulationCommandFromNormalizedInput(
    referenceCase.input,
    createSimulationSeed(referenceCase.seed),
  );
  return canonicalizeTypeScriptResult(
    simulateMonteCarloLocal(
      command,
      createSeededSampleIndexDrawPort(command.seed),
    ),
  );
}

function errorPayload(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return { type: error.name, message: error.message };
  }
  return { type: typeof error, message: String(error) };
}

export function runTypeScriptCorpus(
  corpus: StatisticalCorpus,
  validationIssues: readonly string[],
  executeCase: TypeScriptCaseExecutor = executeTypeScriptCase,
): Record<string, unknown> {
  const header = {
    engine: "typescript",
    corpus_id: corpus.corpus_id,
    schema_version: corpus.schema_version,
    normative_contract: {
      id: corpus.normative_contract.id,
      version: corpus.normative_contract.version,
    },
    prng_contract: corpus.prng_contract.id,
  };
  if (validationIssues.length > 0) {
    return {
      ...header,
      status: "invalid_corpus",
      diagnostics: [...validationIssues],
      cases: [],
    };
  }
  const cases = corpus.cases.map((referenceCase) => {
    try {
      return {
        id: referenceCase.id,
        status: "ok",
        result: executeCase(referenceCase),
      };
    } catch (error) {
      return {
        id: referenceCase.id,
        status: "engine_error",
        error: errorPayload(error),
      };
    }
  });
  return {
    ...header,
    status: cases.some((caseReport) => caseReport.status === "engine_error")
      ? "engine_error"
      : "completed",
    cases,
  };
}

export function runTypeScriptValidationProbes(
  probes: ValidationProbeDocument,
): Record<string, unknown> {
  return {
    engine: "typescript",
    schema_version: probes.schema_version,
    normative_contract: probes.normative_contract,
    status: "completed",
    cases: probes.cases.map((probe) => {
      try {
        createSimulationCommandFromNormalizedInput(
          probe.input,
          createSimulationSeed(probe.seed),
        );
        return { id: probe.id, accepted: true };
      } catch {
        return { id: probe.id, accepted: false };
      }
    }),
  };
}
