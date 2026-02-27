import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildQuickFiltersScopeKey,
  readStoredQuickFilters,
  storageGetItem,
  storageRemoveItem,
  storageSetItem,
  writeStoredQuickFilters,
} from "./storage";

describe("storage helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("reads, writes and removes values with localStorage", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem");

    storageSetItem("k", "v");
    storageGetItem("k");
    storageRemoveItem("k");

    expect(setSpy).toHaveBeenCalledWith("k", "v");
    expect(getSpy).toHaveBeenCalledWith("k");
    expect(removeSpy).toHaveBeenCalledWith("k");
  });

  it("swallows localStorage errors", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(storageGetItem("k")).toBeNull();
    expect(() => storageSetItem("k", "v")).not.toThrow();
    expect(() => storageRemoveItem("k")).not.toThrow();
  });

  it("builds scoped quick-filters keys", () => {
    expect(buildQuickFiltersScopeKey(" Org ", "Projet", " Team A ")).toBe("Org::Projet::Team A");
  });

  it("writes and reads quick filters", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    writeStoredQuickFilters(scopeKey, { types: ["Bug"], doneStates: ["Done"] });

    expect(readStoredQuickFilters(scopeKey)).toEqual({
      types: ["Bug"],
      doneStates: ["Done"],
    });
  });

  it("returns null when quick filters JSON is invalid", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    storageSetItem(`mc_quick_filters_v1::${scopeKey}`, "{");

    expect(readStoredQuickFilters(scopeKey)).toBeNull();
  });

  it("returns null when quick filters scope key is empty and write is ignored", () => {
    writeStoredQuickFilters("", { types: ["Bug"], doneStates: ["Done"] });
    expect(readStoredQuickFilters("")).toBeNull();
  });

  it("normalizes non-array quick filter payload to empty arrays", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
    storageSetItem(
      `mc_quick_filters_v1::${scopeKey}`,
      JSON.stringify({ types: "Bug", doneStates: { state: "Done" } }),
    );

    expect(readStoredQuickFilters(scopeKey)).toEqual({ types: [], doneStates: [] });
  });

  it("returns null when scope key exists but no quick filters are stored", () => {
    const scopeKey = buildQuickFiltersScopeKey("Org", "Projet", "Team Z");
    expect(readStoredQuickFilters(scopeKey)).toBeNull();
  });
});
