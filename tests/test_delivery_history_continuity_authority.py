from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SOURCE = ROOT / "frontend" / "src"
AUTHORITY = "frontend/src/domain/delivery/historyContinuity.ts"


def _production_typescript() -> list[Path]:
    return sorted(
        path
        for path in FRONTEND_SOURCE.rglob("*")
        if path.suffix in {".ts", ".tsx"} and ".test." not in path.name
    )


def test_delivery_history_continuity_has_one_production_authority() -> None:
    competing_paths: list[str] = []
    for path in _production_typescript():
        source = path.read_text(encoding="utf-8")
        owns_diagnostics = any(
            marker in source
            for marker in (
                '"missing_expected_delivery_events"',
                '"ambiguous_delivery_event_sequence"',
            )
        )
        derives_continuity_from_events = all(
            marker in source
            for marker in ('"item_delivered"', "continuity", "new Set(")
        )
        if owns_diagnostics or derives_continuity_from_events:
            competing_paths.append(path.relative_to(ROOT).as_posix())

    assert competing_paths == [AUTHORITY]


def test_azure_devops_consumer_uses_the_delivery_result_without_local_detection() -> None:
    source = (FRONTEND_SOURCE / "adoClient.ts").read_text(encoding="utf-8")

    assert source.count("createDeliveryHistory(") == 1
    assert 'deliveryHistory.continuity === "discontinuous"' in source
    assert 'deliveryHistory.continuity === "ambiguous"' in source
    assert "selectDeliveryHistoryEvents(completePeriod, deliveryHistory.events)" in source
    assert "events: selectedDeliveryEvents" in source
    assert "qualifyDeliveryChronology(deliveryHistoryResult.events)" in source
    assert "calculateDeliveryThroughput(completePeriod, deliveryChronology)" in source
    for removed_marker in (
        "batchFailures",
        "deliveryEvents.filter",
        '"missing_expected_delivery_events"',
        '"ambiguous_delivery_event_sequence"',
    ):
        assert removed_marker not in source
