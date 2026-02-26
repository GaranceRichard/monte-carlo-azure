import { describe, expect, it, vi } from "vitest";
import { storageGetItem, storageRemoveItem, storageSetItem } from "./storage";

describe("storage helpers", () => {
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
});
