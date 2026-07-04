from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest

from Scripts.check_identity_boundary import collect_identity_boundary_violations


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def _build_repo(root: Path, overrides: dict[str, str] | None = None) -> Path:
    files = {
        "frontend/src/types.ts": """
            export type ForecastRequestPayload = {
              throughput_samples: number[];
              include_zero_weeks?: boolean;
              mode: "backlog_to_weeks" | "weeks_to_items";
              backlog_size?: number;
              target_weeks?: number;
              n_sims: number;
            };
        """,
        "frontend/src/api.ts": """
            import type { ForecastRequestPayload } from "./types";

            export type SimulateRequest = ForecastRequestPayload;

            export async function postSimulate(payload: SimulateRequest) {
              return fetch("/simulate", {
                method: "POST",
                body: JSON.stringify(payload),
              });
            }
        """,
        "frontend/src/hooks/simulationForecastCore.ts": """
            import { postSimulate } from "../api";
            import type { ForecastRequestPayload } from "../types";

            export async function runSimulation() {
              const payload: ForecastRequestPayload = {
                throughput_samples: [1, 2, 3, 4, 5, 6],
                mode: "backlog_to_weeks",
                backlog_size: 10,
                n_sims: 2000,
              };
              return postSimulate(payload);
            }
        """,
        "frontend/src/hooks/simulationForecastService.ts": """
            export function noop() {
              return null;
            }
        """,
        "frontend/src/hooks/useOnboarding.ts": """
            export function useOnboarding() {
              const selectedTeam = "Equipe Alpha";
              const selectedOrg = "demo-org";
              return { selectedTeam, selectedOrg };
            }
        """,
        "frontend/src/adoClient.ts": """
            const ADO = "https://dev.azure.com";
            const VSSPS = "https://app.vssps.visualstudio.com";

            export function adoHeaders(pat: string) {
              return {
                Authorization: `Basic ${pat}`,
              };
            }

            export { ADO, VSSPS };
        """,
        "frontend/vite.config.js": """
            export default {
              server: {
                proxy: {
                  "/simulate": "http://127.0.0.1:8000",
                  "/simulations": "http://127.0.0.1:8000",
                },
              },
            };
        """,
        "backend/api_models.py": """
            from pydantic import BaseModel, ConfigDict

            class SimulateRequest(BaseModel):
                model_config = ConfigDict(extra="forbid")
                throughput_samples: list[int]
                include_zero_weeks: bool = False
                mode: str
                backlog_size: int | None = None
                target_weeks: int | None = None
                n_sims: int = 2000

            class SimulationHistoryItem(BaseModel):
                created_at: str
                last_seen: str
                mode: str
                n_sims: int
        """,
        "backend/api_routes_simulate.py": """
            from fastapi import APIRouter, Request

            from .api_models import SimulateRequest, SimulationHistoryItem

            router = APIRouter()

            @router.post("/simulate")
            async def simulate(req: SimulateRequest):
                return {"mode": req.mode}

            @router.get("/simulations/history", response_model=list[SimulationHistoryItem])
            def simulation_history(request: Request) -> list[SimulationHistoryItem]:
                return []
        """,
        "backend/simulation_store.py": """
            from typing import Any

            from .api_models import SimulateRequest

            SENSITIVE_HISTORY_FIELDS = {
                "selected_org": 0,
                "selected_project": 0,
                "selected_team": 0,
                "client_context": 0,
                "pat": 0,
                "server_url": 0,
                "azure_devops_url": 0,
            }

            class SimulationStore:
                def save_simulation(
                    self,
                    mc_client_id: str,
                    req: SimulateRequest,
                    response: Any,
                ) -> None:
                    doc: dict[str, Any] = {
                        "mc_client_id": mc_client_id,
                        "mode": req.mode,
                        "n_sims": req.n_sims,
                    }
                    _ = response
                    _ = doc
        """,
        "ARCHITECTURE.md": """
            Le terme selected_org apparait ici pour documenter la politique.
        """,
    }
    if overrides:
        files.update(overrides)

    for relative_path, content in files.items():
        _write(root / relative_path, content)
    return root


def _collect_rules(root: Path) -> set[str]:
    return {violation.rule for violation in collect_identity_boundary_violations(root)}


@pytest.fixture
def repo_root(tmp_path_factory: pytest.TempPathFactory | None = None) -> Path:
    _ = tmp_path_factory
    base_dir = Path(__file__).resolve().parents[1] / ".tmp_identity_boundary_tests"
    base_dir.mkdir(parents=True, exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix="repo-", dir=base_dir))
    try:
        yield root
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_collect_identity_boundary_violations_returns_empty_for_compliant_repo(
    repo_root: Path,
) -> None:
    repo = _build_repo(repo_root)

    violations = collect_identity_boundary_violations(repo)

    assert violations == []


def test_selected_team_in_simulate_request_triggers_identity_004(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "backend/api_models.py": """
                from pydantic import BaseModel, ConfigDict

                class SimulateRequest(BaseModel):
                    model_config = ConfigDict(extra="forbid")
                    throughput_samples: list[int]
                    selected_team: str
                    mode: str
                    n_sims: int = 2000

                class SimulationHistoryItem(BaseModel):
                    created_at: str
                    last_seen: str
                    mode: str
                    n_sims: int
            """,
        },
    )

    violations = collect_identity_boundary_violations(repo)

    assert ("IDENTITY-004", "selected_team") in {(v.rule, v.token) for v in violations}


def test_selected_org_persisted_in_store_triggers_identity_006(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "backend/simulation_store.py": """
                from typing import Any

                from .api_models import SimulateRequest

                class SimulationStore:
                    def save_simulation(
                        self,
                        mc_client_id: str,
                        req: SimulateRequest,
                        response: Any,
                    ) -> None:
                        doc: dict[str, Any] = {
                            "mc_client_id": mc_client_id,
                            "selected_org": req.selected_org,
                            "mode": req.mode,
                        }
                        _ = response
                        _ = doc
            """,
        },
    )

    violations = collect_identity_boundary_violations(repo)

    assert ("IDENTITY-006", "selected_org") in {(v.rule, v.token) for v in violations}


def test_pat_in_forecast_request_payload_triggers_identity_004(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "frontend/src/types.ts": """
                export type ForecastRequestPayload = {
                  throughput_samples: number[];
                  mode: "backlog_to_weeks" | "weeks_to_items";
                  pat: string;
                  n_sims: number;
                };
            """,
        },
    )

    violations = collect_identity_boundary_violations(repo)

    assert ("IDENTITY-004", "pat") in {(v.rule, v.token) for v in violations}


def test_selected_project_in_history_model_triggers_identity_007(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "backend/api_models.py": """
                from pydantic import BaseModel, ConfigDict

                class SimulateRequest(BaseModel):
                    model_config = ConfigDict(extra="forbid")
                    throughput_samples: list[int]
                    mode: str
                    n_sims: int = 2000

                class SimulationHistoryItem(BaseModel):
                    created_at: str
                    last_seen: str
                    mode: str
                    selected_project: str
                    n_sims: int
            """,
        },
    )

    violations = collect_identity_boundary_violations(repo)

    assert ("IDENTITY-007", "selected_project") in {(v.rule, v.token) for v in violations}


def test_backend_fetch_to_dev_azure_com_triggers_identity_008(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "backend/api_routes_simulate.py": """
                import requests
                from fastapi import APIRouter, Request

                from .api_models import SimulateRequest, SimulationHistoryItem

                router = APIRouter()

                @router.post("/simulate")
                async def simulate(req: SimulateRequest):
                    requests.get("https://dev.azure.com/demo/_apis/projects", timeout=5)
                    return {"mode": req.mode}

                @router.get("/simulations/history", response_model=list[SimulationHistoryItem])
                def simulation_history(request: Request) -> list[SimulationHistoryItem]:
                    return []
            """,
        },
    )

    violations = collect_identity_boundary_violations(repo)

    assert ("IDENTITY-008", "dev.azure.com") in {(v.rule, v.token) for v in violations}


def test_vite_proxy_ado_triggers_identity_001(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "frontend/vite.config.js": """
                export default {
                  server: {
                    proxy: {
                      "/ado": "http://127.0.0.1:8000",
                    },
                  },
                };
            """,
        },
    )

    violations = collect_identity_boundary_violations(repo)

    assert ("IDENTITY-001", "/ado") in {(v.rule, v.token) for v in violations}


def test_selected_team_in_use_onboarding_is_allowed(repo_root: Path) -> None:
    repo = _build_repo(repo_root)

    violations = collect_identity_boundary_violations(repo)

    assert violations == []


def test_pat_in_ado_client_only_is_allowed(repo_root: Path) -> None:
    repo = _build_repo(repo_root)

    violations = collect_identity_boundary_violations(repo)

    assert violations == []


def test_selected_org_in_architecture_documentation_is_allowed(repo_root: Path) -> None:
    repo = _build_repo(repo_root)

    violations = collect_identity_boundary_violations(repo)

    assert violations == []
