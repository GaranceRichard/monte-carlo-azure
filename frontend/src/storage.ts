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
