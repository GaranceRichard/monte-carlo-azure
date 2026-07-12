import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storageGetItem, storageSetItem } from "../storage";
import { useSimulationPrefs } from "./useSimulationPrefs";

vi.mock("../storage", () => ({ storageGetItem: vi.fn(), storageSetItem: vi.fn() }));

describe("useSimulationPrefs", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses date defaults when no preference is stored and persists public changes", () => {
    vi.mocked(storageGetItem).mockReturnValue(null);
    const { result } = renderHook(() => useSimulationPrefs({ startDate: "2026-01-01", endDate: "2026-02-01" }));
    expect(result.current).toMatchObject({ startDate: "2026-01-01", endDate: "2026-02-01", simulationMode: "backlog_to_weeks", includeZeroWeeks: true, backlogSize: 120, targetWeeks: 12, nSims: 20000 });
    act(() => result.current.setNSims(""));
    expect(storageSetItem).toHaveBeenLastCalledWith("mc_simulation_prefs_v2", expect.stringContaining('"nSims":0'));
  });

  it("loads valid stored preferences and ignores malformed storage", () => {
    vi.mocked(storageGetItem).mockReturnValue(JSON.stringify({ startDate: "2025-01-01", endDate: "2025-02-01", simulationMode: "weeks_to_items", includeZeroWeeks: false, backlogSize: 4, targetWeeks: 6, nSims: 2000 }));
    const { result, unmount } = renderHook(() => useSimulationPrefs());
    expect(result.current).toMatchObject({ startDate: "2025-01-01", simulationMode: "weeks_to_items", includeZeroWeeks: false, nSims: 2000 });
    unmount();
    vi.mocked(storageGetItem).mockReturnValue("{");
    expect(renderHook(() => useSimulationPrefs({ startDate: "2026-01-01", endDate: "2026-02-01" })).result.current.startDate).toBe("2026-01-01");
  });

  it("uses forced demo defaults instead of stored dates", () => {
    vi.mocked(storageGetItem).mockReturnValue(JSON.stringify({ startDate: "2020-01-01", endDate: "2020-02-01" }));
    const { result } = renderHook(() => useSimulationPrefs({ startDate: "2026-03-01", endDate: "2026-04-01", forceDefaults: true }));
    expect(result.current).toMatchObject({ startDate: "2026-03-01", endDate: "2026-04-01" });
  });
});
