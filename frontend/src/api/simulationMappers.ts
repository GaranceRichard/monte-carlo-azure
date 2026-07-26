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
} from "../domain/simulationValueObjects";
import type {
  CompletionSummaryDto,
  SimulateRequestDto,
  SimulateResponseDto,
  SimulationHistoryItemDto,
  ThroughputReliabilityDto,
} from "./simulationDtos";

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

export function simulationCommandToDto(command: SimulationCommand): SimulateRequestDto {
  return {
    throughput_samples: [...command.throughputSamples.rawValues],
    include_zero_weeks: command.throughputSamples.includeZeroWeeks,
    mode: command.mode,
    backlog_size: command.backlogSize,
    target_weeks: command.targetWeeks,
    n_sims: command.nSims,
    seed: command.seed,
  };
}

export function simulateResponseDtoToResult(
  dto: SimulateResponseDto,
  expectedNSims?: number,
): SimulationResult {
  const mode = dto.result_kind === "weeks" ? "backlog_to_weeks" : "weeks_to_items";
  const completionTotal = dto.completion_summary === undefined
    ? undefined
    : dto.completion_summary.completed_count + dto.completion_summary.censored_count;
  const nSims = createSimulationCount(expectedNSims ?? completionTotal ?? (
    dto.result_distribution?.reduce((sum, bucket) => sum + bucket.count, 0)
  ));
  const completionSummary = dto.completion_summary === undefined
    ? undefined
    : toCompletionSummary(dto.completion_summary, nSims);
  const resultDistribution = createHistogram(
    dto.result_distribution ?? [],
    completionSummary?.completedCount ?? nSims,
  );
  if (dto.result_kind === "weeks" && completionSummary === undefined) {
    throw new Error("completion_summary est requis pour backlog_to_weeks.");
  }
  if (dto.result_kind === "items" && completionSummary !== undefined) {
    throw new Error("completion_summary est interdit pour weeks_to_items.");
  }
  return Object.freeze({
    resultKind: dto.result_kind,
    samplesCount: dto.samples_count,
    seed: createSimulationSeed(dto.seed),
    resultPercentiles: createSimulationPercentiles(mode, dto.result_percentiles),
    ...(dto.risk_score === undefined ? {} : { riskScore: dto.risk_score }),
    resultDistribution,
    ...(completionSummary === undefined ? {} : { completionSummary }),
    ...(dto.throughput_reliability === undefined
      ? {}
      : { throughputReliability: toThroughputReliability(dto.throughput_reliability) }),
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
