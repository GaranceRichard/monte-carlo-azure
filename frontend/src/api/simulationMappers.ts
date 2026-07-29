import type {
  ServerSimulationHistoryItem,
  SimulationCommand,
  SimulationResult,
} from "../domain/simulation";
import {
  createBacklogSize,
  createCompletionSummary,
  createHistogram,
  createSimulationCount,
  createSimulationHorizon,
  createSimulationPercentiles,
  createSimulationSeed,
  createThroughputReliability,
  SIMULATION_THROUGHPUT_SAMPLES_MAX,
  SIMULATION_THROUGHPUT_SAMPLES_MIN,
} from "../domain/simulationValueObjects";
import type {
  CompletionSummaryDto,
  SimulateRequestDto,
  SimulateResponseDto,
  SimulationHistoryItemDto,
  ThroughputReliabilityDto,
} from "./simulationDtos";

function closedRecord(
  value: unknown,
  fieldName: string,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} doit etre un objet.`);
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new Error(`${fieldName} contient des champs inconnus.`);
  }
  return record;
}

function canonicalSamplesCount(value: unknown): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < SIMULATION_THROUGHPUT_SAMPLES_MIN
    || value > SIMULATION_THROUGHPUT_SAMPLES_MAX
  ) {
    throw new Error("samples_count doit etre un entier compris entre 6 et 521.");
  }
  return value;
}

function canonicalRiskScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("risk_score doit etre un nombre fini >= 0.");
  }
  return value;
}

function toCompletionSummary(
  dto: CompletionSummaryDto,
  nSims: ReturnType<typeof createSimulationCount>,
) {
  return createCompletionSummary({
    completedCount: dto.completed_count,
    censoredCount: dto.censored_count,
    nSims,
    censoredRate: dto.censored_rate,
    horizonWeeks: dto.horizon_weeks,
  });
}

function toThroughputReliability(dto: ThroughputReliabilityDto) {
  return createThroughputReliability({
    cv: dto.cv,
    iqrRatio: dto.iqr_ratio,
    slopeNorm: dto.slope_norm,
    label: dto.label,
    samplesCount: dto.samples_count,
  });
}

function canonicalDistribution(
  value: unknown,
): { x: unknown; count: unknown }[] {
  if (!Array.isArray(value)) {
    throw new Error("result_distribution doit etre une collection.");
  }
  return value.map((bucket) => {
    const record = closedRecord(
      bucket,
      "result_distribution.bucket",
      ["x", "count"],
    );
    return { x: record.x, count: record.count };
  });
}

function canonicalCompletion(
  dto: Record<string, unknown>,
  expectedNSims: number | undefined,
  distributionDto: { x: unknown; count: unknown }[],
) {
  const completionDto = dto.completion_summary === undefined
    ? undefined
    : closedRecord(
        dto.completion_summary,
        "completion_summary",
        ["completed_count", "censored_count", "censored_rate", "horizon_weeks"],
      );
  const completionTotal = completionDto === undefined
    ? undefined
    : Number(completionDto.completed_count) + Number(completionDto.censored_count);
  const nSims = createSimulationCount(expectedNSims ?? completionTotal ?? (
    distributionDto.reduce((sum, bucket) => sum + Number(bucket.count), 0)
  ));
  const completionSummary = completionDto === undefined
    ? undefined
    : toCompletionSummary(completionDto as CompletionSummaryDto, nSims);
  const resultDistribution = createHistogram(
    distributionDto,
    completionSummary?.completedCount ?? nSims,
  );
  if (dto.result_kind === "weeks" && completionSummary === undefined) {
    throw new Error("completion_summary est requis pour backlog_to_weeks.");
  }
  if (dto.result_kind === "items" && completionSummary !== undefined) {
    throw new Error("completion_summary est interdit pour weeks_to_items.");
  }
  return { completionSummary, resultDistribution };
}

function canonicalReliability(
  value: unknown,
  samplesCount: number,
) {
  const reliabilityDto = closedRecord(
    value,
    "throughput_reliability",
    ["cv", "iqr_ratio", "slope_norm", "label", "samples_count"],
  );
  const reliability = toThroughputReliability(
    reliabilityDto as ThroughputReliabilityDto,
  );
  if (samplesCount !== reliability.samplesCount) {
    throw new Error("samples_count doit correspondre a throughput_reliability.");
  }
  return reliability;
}

export function simulationCommandToDto(command: SimulationCommand): SimulateRequestDto {
  const common = {
    throughput_samples: [...command.throughputSamples.rawValues],
    include_zero_weeks: command.throughputSamples.includeZeroWeeks,
    mode: command.mode,
    n_sims: command.nSims,
    seed: command.seed,
  };
  if (command.mode === "backlog_to_weeks") {
    return { ...common, mode: command.mode, backlog_size: command.backlogSize };
  }
  return { ...common, mode: command.mode, target_weeks: command.targetWeeks };
}

export function simulateResponseDtoToResult(
  dtoValue: SimulateResponseDto | unknown,
  expectedNSims?: number,
): SimulationResult {
  const dto = closedRecord(
    dtoValue,
    "La reponse",
    [
      "result_kind",
      "samples_count",
      "seed",
      "result_percentiles",
      "risk_score",
      "result_distribution",
      "completion_summary",
      "throughput_reliability",
    ],
  );
  if (dto.result_kind !== "weeks" && dto.result_kind !== "items") {
    throw new Error("result_kind invalide.");
  }
  const mode = dto.result_kind === "weeks" ? "backlog_to_weeks" : "weeks_to_items";
  const resultPercentiles = createSimulationPercentiles(
    mode,
    closedRecord(dto.result_percentiles, "result_percentiles", ["P50", "P70", "P90"]),
  );
  const { completionSummary, resultDistribution } = canonicalCompletion(
    dto,
    expectedNSims,
    canonicalDistribution(dto.result_distribution),
  );
  const samplesCount = canonicalSamplesCount(dto.samples_count);
  const throughputReliability = canonicalReliability(
    dto.throughput_reliability,
    samplesCount,
  );
  const riskScore = "risk_score" in dto
    ? canonicalRiskScore(dto.risk_score)
    : undefined;
  return Object.freeze({
    resultKind: dto.result_kind,
    samplesCount,
    seed: createSimulationSeed(dto.seed),
    resultPercentiles,
    ...(riskScore === undefined ? {} : { riskScore }),
    resultDistribution,
    ...(completionSummary === undefined ? {} : { completionSummary }),
    throughputReliability,
  });
}

export function simulationHistoryItemDtoToModel(
  dto: SimulationHistoryItemDto,
): ServerSimulationHistoryItem {
  const mode = dto.mode;
  const nSims = createSimulationCount(dto.n_sims);
  const completionSummary = dto.completion_summary === undefined
    ? undefined
    : toCompletionSummary(dto.completion_summary, nSims);
  const expectedMass = completionSummary?.completedCount
    ?? nSims;
  return Object.freeze({
    createdAt: dto.created_at,
    lastSeen: dto.last_seen,
    mode,
    ...(dto.seed === undefined || dto.seed === null
      ? (dto.seed === null ? { seed: null } : {})
      : { seed: createSimulationSeed(dto.seed) }),
    ...(dto.backlog_size === undefined || dto.backlog_size === null
      ? (dto.backlog_size === null ? { backlogSize: null } : {})
      : { backlogSize: createBacklogSize(dto.backlog_size) }),
    ...(dto.target_weeks === undefined || dto.target_weeks === null
      ? (dto.target_weeks === null ? { targetWeeks: null } : {})
      : { targetWeeks: createSimulationHorizon(dto.target_weeks) }),
    nSims,
    samplesCount: dto.samples_count,
    percentiles: createSimulationPercentiles(mode, dto.percentiles),
    distribution: createHistogram(dto.distribution, expectedMass),
    ...(completionSummary === undefined ? {} : { completionSummary }),
    ...(dto.include_zero_weeks === undefined
      ? {}
      : { includeZeroWeeks: dto.include_zero_weeks }),
    ...(dto.throughput_reliability === undefined
      ? {}
      : { throughputReliability: toThroughputReliability(dto.throughput_reliability) }),
  });
}
