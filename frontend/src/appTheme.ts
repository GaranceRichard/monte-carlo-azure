import { storageSetItem } from "./storage";

export type ThemeMode = "light" | "dark";

export function resolveInitialTheme(saved: string | null): ThemeMode {
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function persistTheme(theme: ThemeMode): void {
  storageSetItem("theme", theme);
  applyTheme(theme);
}

