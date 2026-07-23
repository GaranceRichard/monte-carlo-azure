import {
  getApiBase,
  readJsonOr,
  toApiErrorMessage,
} from "./apiHelpers";
import type { SimulateRequestDto, SimulateResponseDto } from "./api/simulationDtos";

const API_BASE = getApiBase();

export async function postSimulate(payload: SimulateRequestDto): Promise<SimulateResponseDto> {
  const response = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await readJsonOr(response, {} as { detail?: string } & SimulateResponseDto);
  if (!response.ok) throw new Error(toApiErrorMessage(response.status, data));
  return data;
}
