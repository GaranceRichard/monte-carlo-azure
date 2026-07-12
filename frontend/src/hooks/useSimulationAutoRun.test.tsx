import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSimulationAutoRun } from "./useSimulationAutoRun";

const params = { step: "simulation" as const, selectedTeam: "Equipe", startDate: "2026-01-01", endDate: "2026-02-01", simulationMode: "backlog_to_weeks" as const, includeZeroWeeks: true, backlogSize: 10, targetWeeks: 4, nSims: 1000, types: ["Bug"], doneStates: ["Done"] };

describe("useSimulationAutoRun", () => {
  afterEach(() => vi.useRealTimers());

  it("does not run on initial render, then runs after a meaningful manual change", () => {
    vi.useFakeTimers();
    const onRun = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ current }) => useSimulationAutoRun({ params: current, hasLaunchedOnce: true, loading: false, onInvalidFilters: vi.fn(), onRun }), { initialProps: { current: params } });
    rerender({ current: { ...params, backlogSize: 11 } });
    act(() => vi.advanceTimersByTime(300));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("reports invalid filters and queues a change until loading finishes", () => {
    const onInvalidFilters = vi.fn();
    const onRun = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ current, loading }) => useSimulationAutoRun({ params: current, hasLaunchedOnce: true, loading, onInvalidFilters, onRun }), { initialProps: { current: params, loading: false } });
    rerender({ current: { ...params, types: [] }, loading: false });
    expect(onInvalidFilters).toHaveBeenCalledOnce();
    rerender({ current: { ...params, targetWeeks: 5 }, loading: true });
    rerender({ current: { ...params, targetWeeks: 5 }, loading: false });
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("cancels the delayed run on cleanup and can reset its state", () => {
    vi.useFakeTimers();
    const onRun = vi.fn().mockResolvedValue(undefined);
    const { result, rerender, unmount } = renderHook(({ current }) => useSimulationAutoRun({ params: current, hasLaunchedOnce: true, loading: false, onInvalidFilters: vi.fn(), onRun }), { initialProps: { current: params } });
    rerender({ current: { ...params, nSims: 1001 } });
    result.current.resetAutoRunState();
    unmount();
    act(() => vi.runAllTimers());
    expect(onRun).not.toHaveBeenCalled();
  });
});
