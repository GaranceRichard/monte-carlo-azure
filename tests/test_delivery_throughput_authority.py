from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SOURCE = ROOT / "frontend" / "src"
AUTHORITY = "frontend/src/domain/delivery/throughput.ts"


def _production_typescript() -> list[Path]:
    return sorted(
        path
        for path in FRONTEND_SOURCE.rglob("*")
        if path.suffix in {".ts", ".tsx"} and ".test." not in path.name
    )


def test_delivery_event_throughput_has_one_production_authority() -> None:
    competing_paths: list[str] = []
    for path in _production_typescript():
        source = path.read_text(encoding="utf-8")
        derives_throughput = "throughput" in source.lower()
        groups_delivery_events = any(
            marker in source
            for marker in ('"item_delivered"', "deliveryWeekOf(", "nextDeliveryWeek(")
        )
        if derives_throughput and groups_delivery_events:
            competing_paths.append(path.relative_to(ROOT).as_posix())

    assert competing_paths == [AUTHORITY]


def test_azure_devops_consumer_delegates_without_a_local_variant() -> None:
    source = (FRONTEND_SOURCE / "adoClient.ts").read_text(encoding="utf-8")

    assert source.count("calculateDeliveryThroughput(") == 1
    for removed_marker in (
        "weekMap",
        "deliveryWeekOf(",
        "nextDeliveryWeek(",
        'event.kind !== "item_delivered"',
    ):
        assert removed_marker not in source
