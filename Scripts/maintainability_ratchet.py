from __future__ import annotations

from typing import Any


def _excepted(kind: str, item: dict[str, Any], exceptions: list[dict[str, Any]]) -> bool:
    ignored = {"id", "kind", "justification"}
    return any(
        exception.get("kind") == kind
        and all(item.get(key) == value for key, value in exception.items() if key not in ignored)
        for exception in exceptions
    )


def _metric_errors(
    snapshot: dict[str, Any], baseline: dict[str, Any], exceptions: list[dict[str, Any]]
) -> list[str]:
    errors: list[str] = []
    previous_metrics = {
        (item["path"], item["metric"], item.get("symbol", "")): item for item in baseline["metrics"]
    }
    for item in snapshot["metrics"]:
        if _excepted("metric", item, exceptions):
            continue
        key = (item["path"], item["metric"], item.get("symbol", ""))
        previous = previous_metrics.get(key)
        if previous is not None and item["value"] <= previous["value"]:
            continue
        previous_value = previous["value"] if previous else "none"
        symbol = f" symbol={item['symbol']}" if "symbol" in item else ""
        errors.append(
            f"{item['path']}: metric={item['metric']}{symbol} "
            f"baseline={previous_value} observed={item['value']} limit={item['limit']}"
        )
    return errors


def _cycle_errors(
    snapshot: dict[str, Any], baseline: dict[str, Any], exceptions: list[dict[str, Any]]
) -> list[str]:
    errors: list[str] = []
    baseline_edges = {
        tuple(edge) for component in baseline["cycles"] for edge in component["edges"]
    }
    for component in snapshot["cycles"]:
        new_edges = [edge for edge in component["edges"] if tuple(edge) not in baseline_edges]
        if not new_edges or _excepted("cycle", {"nodes": component["nodes"]}, exceptions):
            continue
        errors.append(
            f"{component['nodes'][0]}: metric=dependency.cycle baseline=absent "
            f"observed={','.join(component['nodes'])} new_edges={new_edges}"
        )
    return errors


def _direction_errors(
    snapshot: dict[str, Any], baseline: dict[str, Any], exceptions: list[dict[str, Any]]
) -> list[str]:
    errors: list[str] = []
    previous = {
        (item["rule"], item["source"], item["target"]) for item in baseline["dependencyViolations"]
    }
    for item in snapshot["dependencyViolations"]:
        key = (item["rule"], item["source"], item["target"])
        if key in previous or _excepted("dependency", item, exceptions):
            continue
        errors.append(
            f"{item['source']}: metric=dependency.direction baseline=absent "
            f"observed={item['target']} rule={item['rule']}"
        )
    return errors


def _mojibake_errors(
    snapshot: dict[str, Any], baseline: dict[str, Any], exceptions: list[dict[str, Any]]
) -> list[str]:
    errors: list[str] = []
    previous_counts = {
        (item["path"], item["pattern"]): item["count"] for item in baseline["mojibake"]
    }
    for item in snapshot["mojibake"]:
        if _excepted("mojibake", item, exceptions):
            continue
        previous = previous_counts.get((item["path"], item["pattern"]))
        if previous is not None and item["count"] <= previous:
            continue
        errors.append(
            f"{item['path']}: metric=mojibake.{item['pattern']} "
            f"baseline={previous if previous is not None else 'none'} observed={item['count']}"
        )
    return errors


def compare_snapshot(
    snapshot: dict[str, Any], baseline: dict[str, Any], exceptions: list[dict[str, Any]]
) -> list[str]:
    return [
        *_metric_errors(snapshot, baseline, exceptions),
        *_cycle_errors(snapshot, baseline, exceptions),
        *_direction_errors(snapshot, baseline, exceptions),
        *_mojibake_errors(snapshot, baseline, exceptions),
    ]
