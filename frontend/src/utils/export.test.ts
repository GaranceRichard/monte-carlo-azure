import { afterEach, describe, expect, it, vi } from "vitest";
import { exportThroughputCsv } from "./export";

describe("exportThroughputCsv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does nothing when there is no throughput to export", () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    exportThroughputCsv([], "Equipe");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("creates, clicks and cleans up a CSV download", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:throughput");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const appendChild = vi.spyOn(document.body, "appendChild");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const remove = vi.spyOn(HTMLAnchorElement.prototype, "remove");

    exportThroughputCsv([{ week: "2026-01-05T00:00:00Z", throughput: 4 }], "Equipe A");

    const link = appendChild.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(link.href).toBe("blob:throughput");
    expect(link.download).toMatch(/^throughput-Equipe A-.+\.csv$/);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:throughput");
  });

  it("uses the neutral team name when an export has no selected team", () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:throughput"), revokeObjectURL: vi.fn() });
    const appendChild = vi.spyOn(document.body, "appendChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    exportThroughputCsv([{ week: "2026-01-05", throughput: 0 }], "");

    expect((appendChild.mock.calls[0]?.[0] as HTMLAnchorElement).download).toMatch(/^throughput-team-.+\.csv$/);
  });
});
