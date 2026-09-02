from __future__ import annotations

from pathlib import Path

import pytest

from Scripts import check_dependency_authority as authority_cli
from Scripts.dependency_authority import load_dependency_authority
from Scripts.dependency_authority_cycles import (
    ModuleCycleInspectionError,
    inspect_repository_module_cycles,
    validate_module_acyclicity,
)


def _validate(texts: dict[str, str]):
    return validate_module_acyclicity(load_dependency_authority(), texts, set(texts))


def _direct_cycle_result():
    return _validate(
        {
            "frontend/src/domain/delivery/index.ts": (
                'import type { Simulation } from "../simulation";\n'
                'import { simulate } from "../simulation/helper";\n'
            ),
            "frontend/src/domain/simulation/index.ts": (
                'import { delivery } from "../delivery";\n'
            ),
            "frontend/src/domain/simulation/helper.ts": "export const simulate = 1;\n",
        }
    )


def test_direct_cycle_including_a_type_import_is_rejected_with_its_edges() -> None:
    result = _direct_cycle_result()

    delivery = "frontend/src/domain/delivery/"
    simulation = "frontend/src/domain/simulation/"
    assert result.files == 3
    assert result.dependencies == 3
    assert result.modules == 2
    assert len(result.module_edges) == 2
    assert result.violations == 1
    assert len(result.cycles) == 1
    assert result.cycles[0].path == (delivery, simulation, delivery)
    assert [edge.dependency.phase for edge in result.cycles[0].edges] == [
        "compile",
        "runtime",
    ]

    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "DEP-MODULE-CYCLE"
    assert diagnostic.source == "frontend/src/domain/delivery/index.ts"
    assert diagnostic.location == "line 1"
    rendered = diagnostic.render()
    assert f"{delivery} -> {simulation} -> {delivery}" in rendered
    assert "frontend/src/domain/delivery/index.ts:line 1" in rendered
    assert "frontend/src/domain/simulation/index.ts:line 1" in rendered
    assert "'../simulation' [compile]" in rendered
    assert "'../delivery' [runtime]" in rendered
    assert "un import de type participe aussi au cycle" in rendered


def test_indirect_cycle_is_rejected_with_a_canonical_closed_path() -> None:
    result = _validate(
        {
            "frontend/src/application/onboarding/index.ts": (
                'export { history } from "../team-history";\n'
            ),
            "frontend/src/application/team-history/index.ts": (
                'const forecast = import("../team-forecast");\n'
            ),
            "frontend/src/application/team-forecast/index.ts": (
                'const onboarding = require("../onboarding");\n'
            ),
        }
    )

    onboarding = "frontend/src/application/onboarding/"
    history = "frontend/src/application/team-history/"
    forecast = "frontend/src/application/team-forecast/"
    assert result.violations == 1
    assert result.cycles[0].path == (onboarding, history, forecast, onboarding)
    assert len(result.cycles[0].edges) == 3
    rendered = result.diagnostics[0].render()
    assert f"{onboarding} -> {history} -> {forecast} -> {onboarding}" in rendered
    assert "export" not in rendered
    assert "'../team-history' [runtime]" in rendered
    assert "'../team-forecast' [runtime]" in rendered
    assert "'../onboarding' [runtime]" in rendered


def test_branched_acyclic_graph_ignores_internal_test_and_legacy_edges() -> None:
    result = _validate(
        {
            "frontend/src/application/onboarding/index.ts": (
                'import { history } from "../team-history";\n'
                'import { forecast } from "../team-forecast";\n'
                'import type { FC } from "react";\n'
            ),
            "frontend/src/application/team-history/index.ts": (
                'import { portfolio } from "../portfolio-forecast";\n'
            ),
            "frontend/src/application/team-forecast/index.ts": (
                'import { portfolio } from "../portfolio-forecast";\n'
                'import { helper } from "./helper";\n'
                'import { legacy } from "../../legacy/helper";\n'
            ),
            "frontend/src/application/team-forecast/helper.ts": "export const helper = 1;\n",
            "frontend/src/application/portfolio-forecast/index.ts": (
                "export const portfolio = 1;\n"
            ),
            "frontend/src/application/statistical-proof/index.ts": (
                'import { onboarding } from "../onboarding";\n'
            ),
            "frontend/src/application/team-forecast/index.test.ts": (
                'import { onboarding } from "../onboarding";\n'
            ),
            "frontend/src/legacy/helper.ts": "export const legacy = 1;\n",
            "frontend/src/legacy/client.ts": (
                'import { onboarding } from "../application/onboarding";\n'
            ),
        }
    )

    assert result.modules == 5
    assert len(result.module_edges) == 5
    assert result.cycles == ()
    assert result.diagnostics == ()
    assert result.violations == 0


def test_cycles_outside_governed_boundaries_remain_out_of_scope() -> None:
    result = _validate(
        {
            "frontend/src/hooks/simulationForecastCore.ts": (
                'import type { Forecast } from "./simulationForecastService";\n'
            ),
            "frontend/src/hooks/simulationForecastService.ts": (
                'import { core } from "./simulationForecastCore";\n'
            ),
        }
    )

    assert result.modules == 0
    assert result.dependencies == 2
    assert result.module_edges == ()
    assert result.cycles == ()
    assert result.diagnostics == ()


def test_python_modules_are_checked_and_parse_errors_fail_closed() -> None:
    cycle = _validate(
        {
            "backend/domain/history/__init__.py": (
                "from backend.application.history import HistoryApplication\n"
            ),
            "backend/application/history/__init__.py": (
                "from backend.domain.history import HistoryDomain\n"
            ),
        }
    )

    assert cycle.violations == 1
    assert cycle.cycles[0].path == (
        "backend/application/history/",
        "backend/domain/history/",
        "backend/application/history/",
    )

    malformed = _validate(
        {"backend/domain/history/entry.py": "from typing import\n"}
    )
    assert malformed.cycles == ()
    assert malformed.violations == 1
    assert malformed.diagnostics[0].code == "DEP-MODULE-CYCLE-PARSE"
    assert malformed.diagnostics[0].location == "line 1"


def test_repository_graph_is_acyclic_and_keeps_only_three_production_edges() -> None:
    result = inspect_repository_module_cycles(load_dependency_authority())

    assert result.modules == 6
    assert [(edge.source, edge.target) for edge in result.module_edges] == [
        (
            "frontend/src/adapters/browser/clock/",
            "frontend/src/ports/clock/",
        ),
        (
            "frontend/src/composition/browser/",
            "frontend/src/adapters/browser/clock/",
        ),
        (
            "frontend/src/composition/browser/",
            "frontend/src/ports/clock/",
        ),
    ]
    assert result.cycles == ()
    assert result.diagnostics == ()


def test_cli_reports_cycles_and_scan_failures(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(
        authority_cli,
        "inspect_repository_module_cycles",
        lambda *_args: _direct_cycle_result(),
    )
    assert authority_cli.main([]) == 1
    assert "DEP-MODULE-CYCLE" in capsys.readouterr().err

    monkeypatch.setattr(
        authority_cli,
        "inspect_repository_module_cycles",
        lambda *_args: (_ for _ in ()).throw(ModuleCycleInspectionError("scan unavailable")),
    )
    assert authority_cli.main([]) == 1
    assert "DEP-MODULE-CYCLE-SCAN" in capsys.readouterr().err


def test_repository_scan_reports_unreadable_sources(tmp_path: Path) -> None:
    source = tmp_path / "frontend" / "src" / "domain" / "delivery" / "index.ts"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"\xff")

    with pytest.raises(ModuleCycleInspectionError, match="Impossible de lire"):
        inspect_repository_module_cycles(load_dependency_authority(), tmp_path)
