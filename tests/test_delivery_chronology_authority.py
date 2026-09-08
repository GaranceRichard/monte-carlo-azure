from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SOURCE = ROOT / "frontend" / "src"
AUTHORITY = "frontend/src/domain/delivery/chronology.ts"

ORDER_COMPARISON = re.compile(
    r"\b(?:startedAt|completedAt)\b.{0,80}(?:<=|>=|<|>).{0,80}"
    r"\b(?:startedAt|completedAt)\b",
    re.DOTALL,
)


def _production_typescript() -> list[Path]:
    return sorted(
        path
        for path in FRONTEND_SOURCE.rglob("*")
        if path.suffix in {".ts", ".tsx"} and ".test." not in path.name
    )


def test_delivery_chronology_has_one_production_authority() -> None:
    authority_paths: list[str] = []
    diagnostic_paths: list[str] = []
    for path in _production_typescript():
        source = path.read_text(encoding="utf-8")
        relative_path = path.relative_to(ROOT).as_posix()
        if "export function qualifyDeliveryChronology(" in source:
            authority_paths.append(relative_path)
        if 'code: "inverted_delivery_event_order"' in source:
            diagnostic_paths.append(relative_path)

    assert authority_paths == [AUTHORITY]
    assert diagnostic_paths == [AUTHORITY]


def test_delivery_calculators_require_the_chronology_result() -> None:
    cycle_time = (
        FRONTEND_SOURCE / "domain" / "delivery" / "cycleTime.ts"
    ).read_text(encoding="utf-8")
    throughput = (
        FRONTEND_SOURCE / "domain" / "delivery" / "throughput.ts"
    ).read_text(encoding="utf-8")
    ado_client = (FRONTEND_SOURCE / "adoClient.ts").read_text(encoding="utf-8")

    for source in (cycle_time, throughput):
        assert "chronology: DeliveryChronologyResult" in source
        assert "chronology.coherentEvents" in source

    assert ado_client.count("qualifyDeliveryChronology(") == 1
    assert "calculateDeliveryThroughput(completePeriod, deliveryChronology)" in ado_client
    assert "calculateCycleTime(deliveryChronology)" in ado_client


def test_no_competing_started_completed_order_validation_exists() -> None:
    competing_paths = [
        path.relative_to(ROOT).as_posix()
        for path in _production_typescript()
        if path.relative_to(ROOT).as_posix() != AUTHORITY
        and ORDER_COMPARISON.search(path.read_text(encoding="utf-8"))
    ]

    assert competing_paths == []
