import { describe, expect, it } from "vitest";
import {
  buildOnPremCollectionUrl,
  extractOnPremCollectionName,
  getAdoDeploymentTarget,
  isOnPremAdoServer,
  normalizeAdoServerUrl,
  listOnPremCollectionCandidates,
} from "./adoPlatform";

describe("adoPlatform", () => {
  it("treats missing server URL as Azure DevOps Cloud", () => {
    expect(isOnPremAdoServer(undefined)).toBe(false);
    expect(getAdoDeploymentTarget(undefined)).toBe("cloud");
  });

  it("treats Microsoft-hosted Azure DevOps URLs as Cloud", () => {
    expect(isOnPremAdoServer("https://dev.azure.com")).toBe(false);
    expect(isOnPremAdoServer("https://app.vssps.visualstudio.com")).toBe(false);
    expect(isOnPremAdoServer("https://contoso.visualstudio.com")).toBe(false);
    expect(getAdoDeploymentTarget("https://dev.azure.com")).toBe("cloud");
  });

  it("detects non-Microsoft hosts as on-premise", () => {
    expect(isOnPremAdoServer("https://ado.internal.contoso.local/tfs")).toBe(true);
    expect(getAdoDeploymentTarget("https://ado.internal.contoso.local/tfs")).toBe("onprem");
  });

  it("extracts and rebuilds on-prem collection URLs", () => {
    expect(extractOnPremCollectionName("https://ado.internal.contoso.local/tfs/DefaultCollection")).toBe("DefaultCollection");
    expect(buildOnPremCollectionUrl("https://ado.internal.contoso.local/tfs", "DefaultCollection")).toBe(
      "https://ado.internal.contoso.local/tfs/DefaultCollection",
    );
  });

  it("normalizes server urls by trimming and removing trailing slashes", () => {
    expect(normalizeAdoServerUrl("  https://ado.internal.contoso.local/tfs/DefaultCollection///  ")).toBe(
      "https://ado.internal.contoso.local/tfs/DefaultCollection",
    );
  });

  it("does not infer a collection from a bare tfs server url", () => {
    expect(extractOnPremCollectionName("https://ado.internal.contoso.local/tfs")).toBe("");
    expect(buildOnPremCollectionUrl("https://ado.internal.contoso.local/tfs", "")).toBe("");
  });

  it("does not infer a collection from _apis endpoints", () => {
    expect(extractOnPremCollectionName("https://ado.internal.contoso.local/tfs/_apis")).toBe("");
  });

  it("lists on-prem collection candidates from left to right", () => {
    expect(listOnPremCollectionCandidates("https://serveur/tfs/collection/projet")).toEqual([
      { collectionName: "tfs", collectionUrl: "https://serveur/tfs" },
      { collectionName: "collection", collectionUrl: "https://serveur/tfs/collection" },
      { collectionName: "projet", collectionUrl: "https://serveur/tfs/collection/projet" },
    ]);
  });

  it("decodes encoded segments when extracting and listing collections", () => {
    expect(extractOnPremCollectionName("https://serveur/tfs/Collection%20A")).toBe("Collection A");
    expect(listOnPremCollectionCandidates("https://serveur/tfs/Collection%20A")).toEqual([
      { collectionName: "tfs", collectionUrl: "https://serveur/tfs" },
      { collectionName: "Collection A", collectionUrl: "https://serveur/tfs/Collection%20A" },
    ]);
  });

  it("reuses the first matching collection segment in a deep on-prem url", () => {
    expect(buildOnPremCollectionUrl("https://devops700.itp.extra/700/TN", "700")).toBe("https://devops700.itp.extra/700");
  });

  it("appends an explicit collection when it is not already present in the path", () => {
    expect(buildOnPremCollectionUrl("https://serveur/tfs", "Collection A")).toBe("https://serveur/tfs/Collection%20A");
  });

  it("returns no on-prem collection candidates when the path is empty", () => {
    expect(listOnPremCollectionCandidates("https://ado.internal.contoso.local")).toEqual([]);
  });

  it("returns no on-prem collection candidates for cloud urls", () => {
    expect(listOnPremCollectionCandidates("https://dev.azure.com/mon-org")).toEqual([]);
    expect(buildOnPremCollectionUrl("https://dev.azure.com/mon-org", "ignored")).toBe("");
  });

  it("falls back to Cloud when the server URL is invalid", () => {
    expect(isOnPremAdoServer("not-a-url")).toBe(false);
    expect(getAdoDeploymentTarget("not-a-url")).toBe("cloud");
  });
});
