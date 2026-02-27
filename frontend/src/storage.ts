export function storageGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best effort only.
  }
}

export function storageRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Best effort only.
  }
}

export type StoredQuickFilters = {
  types: string[];
  doneStates: string[];
};

export type StoredPortfolioPrefs = {
  arrimageRate?: number;
};

const QUICK_FILTERS_KEY_PREFIX = "mc_quick_filters_v1::";
const PORTFOLIO_PREFS_KEY = "mc_portfolio_prefs_v1";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function buildQuickFiltersScopeKey(org: string, project: string, team: string): string {
  return [org, project, team].map((part) => part.trim()).join("::");
}

export function readStoredQuickFilters(scopeKey: string): StoredQuickFilters | null {
  if (!scopeKey) return null;
  const raw = storageGetItem(`${QUICK_FILTERS_KEY_PREFIX}${scopeKey}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { types?: unknown; doneStates?: unknown };
    return {
      types: toStringArray(parsed.types),
      doneStates: toStringArray(parsed.doneStates),
    };
  } catch {
    return null;
  }
}

export function writeStoredQuickFilters(scopeKey: string, quickFilters: StoredQuickFilters): void {
  if (!scopeKey) return;
  storageSetItem(
    `${QUICK_FILTERS_KEY_PREFIX}${scopeKey}`,
    JSON.stringify({
      types: [...quickFilters.types],
      doneStates: [...quickFilters.doneStates],
    }),
  );
}

export function readStoredPortfolioPrefs(): StoredPortfolioPrefs {
  const raw = storageGetItem(PORTFOLIO_PREFS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StoredPortfolioPrefs;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeStoredPortfolioPrefs(prefs: StoredPortfolioPrefs): void {
  storageSetItem(PORTFOLIO_PREFS_KEY, JSON.stringify(prefs));
}
