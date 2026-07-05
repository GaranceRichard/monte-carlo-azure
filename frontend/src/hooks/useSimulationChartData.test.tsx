import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as probability from "./probability";
import { useSimulationChartData } from "./useSimulationChartData";

describe("useSimulationChartData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty chart datasets when no result is available", () => {
    const { result } = renderHook(() =>
      useSimulationChartData({
        weeklyThroughput: [],
        cycleTimeDaysData: [],
        includeZeroWeeks: true,
        result: null,
      }),
    );

    expect(result.current.mcHistData).toEqual([]);
    expect(result.current.probabilityCurveData).toEqual([]);
    expect(result.current.displayPercentiles).toEqual({});
  });

  it("filters zero-throughput weeks when includeZeroWeeks is false", () => {
    const { result } = renderHook(() =>
      useSimulationChartData({
        weeklyThroughput: [
          { week: "2026-01-05T00:00:00Z", throughput: 0 },
          { week: "2026-01-12T00:00:00Z", throughput: 3 },
        ],
        cycleTimeDaysData: [],
        includeZeroWeeks: false,
        result: null,
      }),
    );

    expect(result.current.throughputData).toEqual([{ week: "2026-01-12", throughput: 3 }]);
  });

  it("builds histogram smoothing and probability curve for valid weeks buckets", () => {
    const probabilitySpy = vi.spyOn(probability, "buildProbabilityCurve");

    const { result } = renderHook(() =>
      useSimulationChartData({
        weeklyThroughput: [],
        cycleTimeDaysData: [],
        includeZeroWeeks: true,
        result: {
          result_kind: "weeks",
          samples_count: 4,
          seed: 1,
          result_percentiles: { P50: 10, P70: 12, P90: 15 },
          result_distribution: [
            { x: 15, count: 1 },
            { x: 10, count: 2 },
            { x: 12, count: 1 },
          ],
        },
      }),
    );

    expect(result.current.displayPercentiles).toEqual({ P50: 10, P70: 12, P90: 15 });
    expect(result.current.mcHistData).toEqual([
      { x: 10, count: 2, gauss: 1.5 },
      { x: 12, count: 1, gauss: 1.2857142857142858 },
      { x: 15, count: 1, gauss: 1.1666666666666667 },
    ]);
    expect(result.current.probabilityCurveData).toEqual([
      { x: 10, probability: 50 },
      { x: 12, probability: 75 },
      { x: 15, probability: 100 },
    ]);
    expect(probabilitySpy).toHaveBeenCalledWith(
      [
        { x: 10, count: 2 },
        { x: 12, count: 1 },
        { x: 15, count: 1 },
      ],
      "weeks",
    );
  });

  it("drops invalid buckets and falls back cleanly when no valid points remain", () => {
    const probabilitySpy = vi.spyOn(probability, "buildProbabilityCurve");
    const percentileSpy = vi.spyOn(probability, "buildAtLeastPercentiles");

    const { result } = renderHook(() =>
      useSimulationChartData({
        weeklyThroughput: [],
        cycleTimeDaysData: [],
        includeZeroWeeks: true,
        result: {
          result_kind: "items",
          samples_count: 3,
          seed: 2,
          result_percentiles: { P50: 1, P70: 2, P90: 3 },
          result_distribution: [
            { x: Number.NaN, count: 1 },
            { x: 5, count: 0 },
            { x: 8, count: Number.NaN },
          ],
        },
      }),
    );

    expect(result.current.mcHistData).toEqual([]);
    expect(result.current.probabilityCurveData).toEqual([]);
    expect(result.current.displayPercentiles).toEqual({ P50: 1, P70: 2, P90: 3 });
    expect(probabilitySpy).not.toHaveBeenCalled();
    expect(percentileSpy).not.toHaveBeenCalled();
  });

  it("uses backend result_percentiles directly for new weeks_to_items responses", () => {
    const spy = vi.spyOn(probability, "buildAtLeastPercentiles");

    const { result } = renderHook(() =>
      useSimulationChartData({
        weeklyThroughput: [],
        cycleTimeDaysData: [],
        includeZeroWeeks: true,
        result: {
          result_kind: "items",
          samples_count: 5,
          seed: 3,
          result_percentiles: { P50: 24, P70: 22, P90: 18 },
          result_distribution: [
            { x: 18, count: 1 },
            { x: 22, count: 1 },
            { x: 24, count: 1 },
            { x: 25, count: 1 },
            { x: 27, count: 1 },
          ],
        },
      }),
    );

    expect(result.current.displayPercentiles).toEqual({ P50: 24, P70: 22, P90: 18 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("recomputes only legacy weeks_to_items percentiles detected as ascending", () => {
    const spy = vi.spyOn(probability, "buildAtLeastPercentiles");

    const { result } = renderHook(() =>
      useSimulationChartData({
        weeklyThroughput: [],
        cycleTimeDaysData: [],
        includeZeroWeeks: true,
        result: {
          result_kind: "items",
          samples_count: 5,
          seed: 4,
          result_percentiles: { P50: 24, P70: 25, P90: 27 },
          result_distribution: [
            { x: 18, count: 1 },
            { x: 22, count: 1 },
            { x: 24, count: 1 },
            { x: 25, count: 1 },
            { x: 27, count: 1 },
          ],
        },
      }),
    );

    expect(result.current.displayPercentiles).toEqual({ P50: 24, P70: 22, P90: 18 });
    expect(spy).toHaveBeenCalledOnce();
  });
});
