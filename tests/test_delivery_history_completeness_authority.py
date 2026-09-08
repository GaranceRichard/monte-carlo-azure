from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SOURCE = ROOT / "frontend" / "src"
AUTHORITY = "frontend/src/domain/delivery/historyCompleteness.ts"


def _production_typescript() -> list[Path]:
    return sorted(
        path
        for path in FRONTEND_SOURCE.rglob("*")
        if path.suffix in {".ts", ".tsx"} and ".test." not in path.name
    )


def test_delivery_history_completeness_has_one_production_authority() -> None:
    status_authorities: list[str] = []
    result_authorities: list[str] = []
    qualifier_authorities: list[str] = []
    status_assigners: list[str] = []
    missing_id_builders: list[str] = []

    for path in _production_typescript():
        source = path.read_text(encoding="utf-8")
        relative = path.relative_to(ROOT).as_posix()
        if "delivery_history_incomplete" in source:
            status_authorities.append(relative)
        if re.search(r"export\s+type\s+DeliveryHistoryResult\s*=", source):
            result_authorities.append(relative)
        if re.search(r"export\s+function\s+createDeliveryHistoryResult\s*\(", source):
            qualifier_authorities.append(relative)
        if re.search(r'\bstatus\s*:\s*"(?:incomplete|absent)"', source):
            status_assigners.append(relative)
        if re.search(r"\b(?:const|let)\s+missingItemIds\b", source):
            missing_id_builders.append(relative)

    assert status_authorities == [AUTHORITY]
    assert result_authorities == [AUTHORITY]
    assert qualifier_authorities == [AUTHORITY]
    assert status_assigners == [AUTHORITY]
    assert missing_id_builders == [AUTHORITY]


def test_cohesive_consumers_use_the_delivery_completeness_result() -> None:
    ado_client = (FRONTEND_SOURCE / "adoClient.ts").read_text(encoding="utf-8")
    forecast = (
        FRONTEND_SOURCE / "application" / "team-forecast" / "localTeamForecast.ts"
    ).read_text(encoding="utf-8")

    assert ado_client.count("createDeliveryHistoryResult(") == 2
    assert "deliveryHistory.completeness" in ado_client
    assert "response.historyCompleteness.status" in forecast
    assert "batchFailures.length" not in ado_client
