export const ADO_CLOUD_BASE_URL = "https://dev.azure.com";
export const ADO_CLOUD_PROFILE_BASE_URL = "https://app.vssps.visualstudio.com";

export type AdoDeploymentTarget = "cloud" | "onprem";

type ParsedOnPremUrl = {
  rootUrl: string;
  collection: string;
};

export type OnPremCollectionCandidate = {
  collectionName: string;
  collectionUrl: string;
};

function tryParseUrl(serverUrl: string | null | undefined): URL | null {
  const normalized = (serverUrl ?? "").trim();
  if (!normalized) return null;

  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

export function isOnPremAdoServer(serverUrl: string | null | undefined): boolean {
  const parsed = tryParseUrl(serverUrl);
  if (!parsed) return false;

  const host = parsed.hostname.toLowerCase();
  return host !== "dev.azure.com" && host !== "app.vssps.visualstudio.com" && !host.endsWith(".visualstudio.com");
}

export function getAdoDeploymentTarget(serverUrl: string | null | undefined): AdoDeploymentTarget {
  return isOnPremAdoServer(serverUrl) ? "onprem" : "cloud";
}

export function normalizeAdoServerUrl(serverUrl: string | null | undefined): string {
  return (serverUrl ?? "").trim().replace(/\/+$/, "");
}

function parseOnPremServerUrl(serverUrl: string | null | undefined): ParsedOnPremUrl | null {
  const normalized = normalizeAdoServerUrl(serverUrl);
  if (!normalized || !isOnPremAdoServer(normalized)) return null;

  const parsed = tryParseUrl(normalized);
  if (!parsed) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "";
  const hasCollectionInPath =
    segments.length > 0 && lastSegment.toLowerCase() !== "tfs" && !lastSegment.startsWith("_");
  const rootSegments = hasCollectionInPath ? segments.slice(0, -1) : segments;
  const rootUrl = `${parsed.origin}${rootSegments.length ? `/${rootSegments.join("/")}` : ""}`;

  return {
    rootUrl,
    collection: hasCollectionInPath ? decodeURIComponent(lastSegment) : "",
  };
}

export function extractOnPremCollectionName(serverUrl: string | null | undefined): string {
  return parseOnPremServerUrl(serverUrl)?.collection ?? "";
}

export function buildOnPremCollectionUrl(
  serverUrl: string | null | undefined,
  collection: string | null | undefined,
): string {
  const normalized = normalizeAdoServerUrl(serverUrl);
  if (!normalized || !isOnPremAdoServer(normalized)) return "";

  const parsedUrl = tryParseUrl(normalized);
  if (!parsedUrl) return "";

  const parsed = parseOnPremServerUrl(normalized);
  if (!parsed) return "";

  const selectedCollection = (collection ?? "").trim() || parsed.collection;
  if (!selectedCollection) return "";

  const segments = parsedUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const matchingIndex = segments.findIndex((segment) => segment === selectedCollection);
  if (matchingIndex >= 0) {
    return `${parsedUrl.origin}/${segments.slice(0, matchingIndex + 1).map(encodeURIComponent).join("/")}`;
  }

  return `${parsed.rootUrl}/${encodeURIComponent(selectedCollection)}`;
}

export function listOnPremCollectionCandidates(serverUrl: string | null | undefined): OnPremCollectionCandidate[] {
  const normalized = normalizeAdoServerUrl(serverUrl);
  if (!normalized || !isOnPremAdoServer(normalized)) return [];

  const parsed = tryParseUrl(normalized);
  if (!parsed) return [];

  const segments = parsed.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (!segments.length) return [];

  return segments.map((segment, index) => ({
    collectionName: segment,
    collectionUrl: `${parsed.origin}/${segments.slice(0, index + 1).map(encodeURIComponent).join("/")}`,
  }));
}
