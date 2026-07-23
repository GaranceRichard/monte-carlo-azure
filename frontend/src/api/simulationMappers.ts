import type {
  CompletionSummary,
  ServerSimulationHistoryItem,
  SimulationCommand,
  SimulationResult,
  ThroughputReliability,
} from "../domain/simulation";
import type {
  CompletionSummaryDto,
  SimulateRequestDto,
  SimulateResponseDto,
  SimulationHistoryItemDto,
  ThroughputReliabilityDto,
} from "./simulationDtos";

function toCompletionSummary(dto: CompletionSummaryDto): CompletionSummary {
  return {
    completedCount: dto.completed_count,
    censoredCount: dto.censored_count,
    censoredRate: dto.censored_rate,
    horizonWeeks: dto.horizon_weeks,
  };
}

function toThroughputReliability(dto: ThroughputReliabilityDto): ThroughputReliability {
  return {
    cv: dto.cv,
    iqrRatio: dto.iqr_ratio,
    slopeNorm: dto.slope_norm,
    label: dto.label,
    samplesCount: dto.samples_count,
  };
}

export function simulationCommandToDto(command: SimulationCommand): SimulateRequestDto {
  return {
    throughput_samples: command.throughputSamples,
    include_zero_weeks: command.includeZeroWeeks,
    mode: command.mode,
    backlog_size: command.backlogSize,
    target_weeks: command.targetWeeks,
    n_sims: command.nSims,
    seed: command.seed,
  };
}

export function simulateResponseDtoToResult(dto: SimulateResponseDto): SimulationResult {
  return {
    resultKind: dto.result_kind,
    samplesCount: dto.samples_count,
    seed: dto.seed,
    resultPercentiles: dto.result_percentiles,
    ...(dto.risk_score === undefined ? {} : { riskScore: dto.risk_score }),
    resultDistribution: dto.result_distribution ?? [],
    ...(dto.completion_summary === undefined
      ? {}
      : { completionSummary: toCompletionSummary(dto.completion_summary) }),
    ...(dto.throughput_reliability === undefined
      ? {}
      : { throughputReliability: toThroughputReliability(dto.throughput_reliability) }),
  };
}

export function simulationHistoryItemDtoToModel(
  dto: SimulationHistoryItemDto,
): ServerSimulationHistoryItem {
  return {
    createdAt: dto.created_at,
    lastSeen: dto.last_seen,
    mode: dto.mode,
    ...(dto.seed === undefined ? {} : { seed: dto.seed }),
    ...(dto.backlog_size === undefined ? {} : { backlogSize: dto.backlog_size }),
    ...(dto.target_weeks === undefined ? {} : { targetWeeks: dto.target_weeks }),
    nSims: dto.n_sims,
    samplesCount: dto.samples_count,
    percentiles: dto.percentiles,
    distribution: dto.distribution,
    ...(dto.completion_summary === undefined
      ? {}
      : { completionSummary: toCompletionSummary(dto.completion_summary) }),
    ...(dto.include_zero_weeks === undefined
      ? {}
      : { includeZeroWeeks: dto.include_zero_weeks }),
    ...(dto.throughput_reliability === undefined
      ? {}
      : { throughputReliability: toThroughputReliability(dto.throughput_reliability) }),
  };
}
