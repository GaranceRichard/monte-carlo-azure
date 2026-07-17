from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest

import Scripts.check_identity_boundary as identity
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


def test_block_extractors_cover_missing_multiline_and_unbalanced_shapes(tmp_path: Path) -> None:
    python_file = tmp_path / "sample.py"
    _write(
        python_file,
        """
def multiline(
    value,
):
    selected_org = value

def next_block():
    return None
""",
    )
    block = identity._extract_python_block(python_file, "def", "multiline")
    assert any("selected_org" in line for _, line in block)
    assert identity._extract_python_block(python_file, "class", "Missing") == []

    ts_file = tmp_path / "sample.ts"
    ts_file.write_text("const marker = value;", encoding="utf-8")
    assert identity._extract_ts_brace_block(ts_file, "missing") == []
    assert identity._extract_ts_brace_block(ts_file, "marker") == []
    ts_file.write_text("const marker = { selected_org: 1;", encoding="utf-8")
    assert identity._extract_ts_brace_block(ts_file, "marker") == []


def test_token_collection_comments_deduplication_and_helpers(tmp_path: Path) -> None:
    path = tmp_path / "sample.ts"
    violations = identity._collect_tokens_in_block(
        path,
        "IDENTITY-005",
        [(1, "// selected_org"), (2, "selected_org selected_org")],
        ("selected_org",),
    )
    assert len(violations) == 1
    collected: list[identity.Violation] = []
    seen: set[tuple] = set()
    identity._append_if_missing(collected, seen, violations[0])
    identity._append_if_missing(collected, seen, violations[0])
    assert len(collected) == 1
    assert identity._is_comment_only(tmp_path / "file.txt", "text") is False
    duplicates = identity._collect_tokens_in_block(
        path, "IDENTITY-005", [(3, "selected_org")], ("selected_org", "selected_org")
    )
    assert len(duplicates) == 1


def test_missing_official_urls_and_payload_fields_are_reported(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "frontend/src/adoClient.ts": "export const value = 1;",
            "frontend/src/hooks/extra.ts": """
                import { postSimulate } from "../api";
                export async function send() {
                  return postSimulate({ selected_team: "x" });
                }
            """,
        },
    )
    violations = collect_identity_boundary_violations(repo)
    pairs = {(item.rule, item.token) for item in violations}
    assert ("IDENTITY-003", "dev.azure.com") in pairs
    assert ("IDENTITY-003", "app.vssps.visualstudio.com") in pairs
    assert ("IDENTITY-005", "selected_team") in pairs


def test_pat_route_and_backend_server_url_are_reported(repo_root: Path) -> None:
    repo = _build_repo(
        repo_root,
        {
            "backend/api_routes_simulate.py": """
                from fastapi import APIRouter
                router = APIRouter()
                @router.get("/pat-token")
                def token_route():
                    server_url = "internal"
                    return server_url
            """,
        },
    )
    pairs = {(item.rule, item.token) for item in collect_identity_boundary_violations(repo)}
    assert ("IDENTITY-002", "pat") in pairs
    assert ("IDENTITY-008", "server_url") in pairs


def test_missing_optional_roots_return_no_violations(tmp_path: Path) -> None:
    assert identity._payload_candidate_files(tmp_path)
    assert identity._collect_identity_001(tmp_path) == []
    assert identity._collect_identity_002(tmp_path) == []
    assert len(identity._collect_identity_003(tmp_path)) == 0
    assert identity._collect_identity_005(tmp_path) == []
    assert identity._collect_identity_006(tmp_path) == []
    assert identity._collect_identity_008(tmp_path) == []


def test_missing_candidates_and_comment_only_backend_tokens_are_ignored(tmp_path: Path) -> None:
    (tmp_path / "frontend/src").mkdir(parents=True)
    (tmp_path / "frontend/src/adoClient.ts").write_text(
        'const A = "https://dev.azure.com";\n'
        'const B = "https://app.vssps.visualstudio.com";\n',
        encoding="utf-8",
    )
    assert identity._collect_identity_002(tmp_path) == []
    (tmp_path / "frontend/vite.config.js").write_text(
        'const route = "/__dev/resolve-pat";\n', encoding="utf-8"
    )
    assert identity._collect_identity_002(tmp_path)
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "module.py").write_text("# server_url only\n", encoding="utf-8")
    assert identity._collect_identity_008(tmp_path) == []


def test_format_and_main_success_and_failure(tmp_path: Path, monkeypatch, capsys) -> None:
    path = tmp_path / "backend" / "api.py"
    violation = identity.Violation(path, "IDENTITY-008", "fetch(", 4)
    assert "backend/api.py:4" in identity._format_violation(tmp_path, violation)

    monkeypatch.setattr(identity, "ROOT", tmp_path)
    monkeypatch.setattr(identity, "collect_identity_boundary_violations", lambda _root: [])
    assert identity.main() == 0
    assert "passed" in capsys.readouterr().out
    monkeypatch.setattr(
        identity,
        "collect_identity_boundary_violations",
        lambda _root: [violation],
    )
    assert identity.main() == 1
    assert "SLA breach" in capsys.readouterr().err
