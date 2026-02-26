import type { NamedEntity } from "../types";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function prefix(value: string): string {
  return (value.split("-")[0] || value).trim();
}

export function sortTeams(teams: NamedEntity[]): NamedEntity[] {
  return [...teams].sort((a, b) => {
    const keyA = normalize(prefix(a.name || ""));
    const keyB = normalize(prefix(b.name || ""));
    if (keyA !== keyB) return keyA.localeCompare(keyB, "fr", { sensitivity: "base" });
    return normalize(a.name || "").localeCompare(normalize(b.name || ""), "fr", { sensitivity: "base" });
  });
}

