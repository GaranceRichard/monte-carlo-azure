import type { SimulateResponse, SimulationHistoryItem } from "./api";

export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

export async function readJsonOr<T>(response: Response, fallback: T): Promise<T> {
  return response.json().catch(() => fallback) as Promise<T>;
}

export function toApiErrorMessage(status: number, data: { detail?: string }): string {
  return data.detail ?? `HTTP ${status}`;
}

export function normalizeSimulationHistory(data: unknown): SimulationHistoryItem[] {
  return Array.isArray(data) ? (data as SimulationHistoryItem[]) : [];
}

export function normalizeSimulateResponse(data: SimulateResponse): SimulateResponse {
  return data;
}
