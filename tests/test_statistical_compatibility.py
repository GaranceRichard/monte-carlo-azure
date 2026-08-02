from __future__ import annotations

import json
import shutil
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable

import pytest
from jsonschema import Draft202012Validator

from Scripts.statistical_compatibility_authority import semantic_diagnostics
from Scripts.statistical_compatibility_common import (
    CLASSIFICATIONS,
    HISTORICAL_DATA_CATEGORIES,
    HISTORICAL_TREATMENTS,
    SURFACES,
    load_json,
)
from Scripts.statistical_compatibility_control import validate_authority_and_evaluate
from Scripts.statistical_compatibility_extractors import component_fingerprint

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = Path("contracts/statistical-compatibility-authority-v1.0.json")
AUTHORITY_SCHEMA_PATH = Path("contracts/statistical-compatibility-authority-v1.0.schema.json")
EVIDENCE_SCHEMA_PATH = Path("contracts/statistical-compatibility-evidence-v1.0.schema.json")


def _authority(root: Path = ROOT) -> dict[str, Any]:
    value = load_json(root / AUTHORITY_PATH)
    assert isinstance(value, dict)
    return value


def _workspace(tmp_path: Path) -> Path:
    authority = _authority()
    paths = {AUTHORITY_PATH, AUTHORITY_SCHEMA_PATH, EVIDENCE_SCHEMA_PATH}
    for component in authority["components"]:
        paths.update(Path(part["path"]) for part in component["authorities"])
    for proof in authority["proof_artifacts"]:
        paths.add(Path(proof["path"]))
        paths.add(Path(proof["schema_path"]))
    for relative in sorted(paths):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    return tmp_path


def _evaluate(root: Path) -> tuple[list[dict[str, Any]], list[Any]]:
    authority = load_json(root / AUTHORITY_PATH)
    schema = load_json(root / AUTHORITY_SCHEMA_PATH)
    states, _proofs, diagnostics = validate_authority_and_evaluate(root, authority, schema)
    return states, diagnostics


def _replace(root: Path, relative: str, old: str, new: str, count: int = 1) -> None:
    path = root / relative
    source = path.read_text(encoding="utf-8")
    assert source.count(old) >= count
    path.write_text(source.replace(old, new, count), encoding="utf-8", newline="\n")


def _mutate_json(root: Path, relative: str, change: Callable[[dict[str, Any]], None]) -> None:
    path = root / relative
    value = load_json(path)
    assert isinstance(value, dict)
    change(value)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _validation_rule(root: Path) -> None:
    _replace(
        root,
        "backend/simulation_limits.py",
        "SIMULATION_THROUGHPUT_SAMPLES_MIN = 6",
        "SIMULATION_THROUGHPUT_SAMPLES_MIN = 7",
    )


def _prng(root: Path) -> None:
    _replace(root, "backend/mca_prng_v1_sample_index_draw_port.py", "0x6D2B79F5", "0x6D2B79F6")


def _draw_to_index(root: Path) -> None:
    _replace(
        root,
        "backend/mca_prng_v1_sample_index_draw_port.py",
        "np.right_shift(low_products, 32)",
        "np.right_shift(low_products, 31)",
    )


def _draw_order(root: Path) -> None:
    _replace(
        root,
        "frontend/src/utils/simulation.ts",
        "for (let index = 0; index < nSims; index += 1)",
        "for (let index = nSims - 1; index >= 0; index -= 1)",
    )


def _censorship(root: Path) -> None:
    _replace(root, "frontend/src/utils/simulation.ts", "if (remaining <= 0)", "if (remaining < 0)")


def _percentile_rank(root: Path) -> None:
    _replace(
        root,
        "backend/mc_core.py",
        "rank = (p * total_count + 99) // 100",
        "rank = (p * total_count + 98) // 100",
    )


def _risk_score(root: Path) -> None:
    _replace(
        root,
        "backend/simulation_value_objects.py",
        "return round_positive_ratio_half_up(max(0, numerator), p50)",
        "return round_positive_ratio_half_up(max(1, numerator), p50)",
    )


def _reliability_label(root: Path) -> None:
    _replace(root, "backend/simulation_value_objects.py", "cv >= 1.5", "cv >= 1.4")


def _histogram(root: Path) -> None:
    _replace(
        root, "backend/histogram.py", "HISTOGRAM_MAX_BUCKETS = 100", "HISTOGRAM_MAX_BUCKETS = 99"
    )


def _response_field_type(root: Path) -> None:
    def change(value: dict[str, Any]) -> None:
        value["$defs"]["expectedResult"]["properties"]["seed"]["type"] = "number"

    _mutate_json(root, "contracts/statistical-reference-corpus-v1.0.schema.json", change)


def _contract_version(root: Path) -> None:
    def change(value: dict[str, Any]) -> None:
        value["components"][0]["current_version"] = "1.1"

    _mutate_json(root, AUTHORITY_PATH.as_posix(), change)


def _corpus_result(root: Path) -> None:
    def change(value: dict[str, Any]) -> None:
        value["cases"][0]["expected_result"]["result_percentiles"]["P50"] += 1

    _mutate_json(root, "contracts/statistical-reference-corpus-v1.0.json", change)


def _proof(root: Path) -> None:
    def change(value: dict[str, Any]) -> None:
        value["summary"]["normative_matches"] -= 1

    _mutate_json(root, "reports/statistical-exact-replay-evidence.json", change)


def _migration_decision(root: Path) -> None:
    def change(value: dict[str, Any]) -> None:
        history = next(
            item for item in value["components"] if item["id"] == "serialization-and-history"
        )
        history["releases"][0]["decision"]["data_treatments"].pop()

    _mutate_json(root, AUTHORITY_PATH.as_posix(), change)


def _append_release(
    authority: dict[str, Any], component_id: str, classification: str
) -> dict[str, Any]:
    component = next(item for item in authority["components"] if item["id"] == component_id)
    previous = component["releases"][-1]
    release = deepcopy(previous)
    release["version"] = "1.1"
    release["semantic_fingerprint"] = "a" * 64
    release["decision"].update(
        {
            "id": f"DEC-{component_id}-1.1",
            "classification": classification,
            "from_version": previous["version"],
            "to_version": "1.1",
            "from_fingerprint": previous["semantic_fingerprint"],
            "to_fingerprint": "a" * 64,
            "changed_surfaces": [component["surfaces"][0]],
        }
    )
    component["current_version"] = "1.1"
    component["releases"].append(release)
    return component


@pytest.mark.parametrize(
    ("mutation", "component", "code"),
    [
        (_validation_rule, "input-contract", "semantic_drift_without_release"),
        (_prng, "prng", "semantic_drift_without_release"),
        (_draw_to_index, "prng", "semantic_drift_without_release"),
        (_draw_order, "draw-order-and-batching", "semantic_drift_without_release"),
        (_censorship, "censorship-and-percentiles", "semantic_drift_without_release"),
        (_percentile_rank, "censorship-and-percentiles", "semantic_drift_without_release"),
        (_risk_score, "risk-score", "semantic_drift_without_release"),
        (_reliability_label, "throughput-reliability", "semantic_drift_without_release"),
        (_histogram, "histogram", "semantic_drift_without_release"),
        (_response_field_type, "canonical-response", "semantic_drift_without_release"),
        (_contract_version, "input-contract", "current_release_mismatch"),
        (_corpus_result, "reference-corpus-contract", "semantic_drift_without_release"),
        (_proof, "compatibility-authority", "proof_fingerprint_drift"),
        (_migration_decision, "serialization-and-history", "historical_treatment_missing"),
    ],
)
def test_controlled_mutations_are_blocked_for_the_expected_reason(
    tmp_path: Path,
    mutation: Callable[[Path], None],
    component: str,
    code: str,
) -> None:
    root = _workspace(tmp_path)
    mutation(root)

    _states, diagnostics = _evaluate(root)

    assert any(item.component == component and item.code == code for item in diagnostics)


def test_current_authority_is_closed_complete_and_deterministic() -> None:
    authority = _authority()
    schema = load_json(ROOT / AUTHORITY_SCHEMA_PATH)
    Draft202012Validator(schema).validate(authority)
    assert tuple(authority["classifications"]) == CLASSIFICATIONS
    assert tuple(authority["historical_treatments"]) == HISTORICAL_TREATMENTS
    assert tuple(authority["historical_data_categories"]) == HISTORICAL_DATA_CATEGORIES
    assert tuple(authority["normative_surfaces"]) == SURFACES
    assert semantic_diagnostics(authority) == []

    first = [component_fingerprint(ROOT, component) for component in authority["components"]]
    second = [component_fingerprint(ROOT, component) for component in authority["components"]]
    assert (
        first
        == second
        == [
            component["releases"][-1]["semantic_fingerprint"]
            for component in authority["components"]
        ]
    )


def test_comments_and_descriptive_documentation_do_not_create_false_drift(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    _replace(
        root,
        "backend/histogram.py",
        "from __future__ import annotations",
        "# Descriptive implementation note.\nfrom __future__ import annotations",
    )
    _replace(
        root,
        "frontend/src/domain/histogram.ts",
        "export const HISTOGRAM_MAX_BUCKETS",
        "// Descriptive implementation note.\nexport const HISTOGRAM_MAX_BUCKETS",
    )

    def change(value: dict[str, Any]) -> None:
        value["cases"][0]["description"] = "Documentation descriptive modifiée sans effet normatif."

    _mutate_json(root, "contracts/statistical-reference-corpus-v1.0.json", change)

    states, diagnostics = _evaluate(root)

    assert diagnostics == []
    assert all(item["classification"] == "no_normative_impact" for item in states)


def test_engine_and_corpus_coordinated_edit_cannot_hide_draw_order_drift(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    _draw_order(root)
    _percentile_rank(root)
    _corpus_result(root)

    _states, diagnostics = _evaluate(root)

    assert any(item.component == "draw-order-and-batching" for item in diagnostics)
    assert any(item.component == "censorship-and-percentiles" for item in diagnostics)
    assert any(item.component == "reference-corpus-contract" for item in diagnostics)
    assert any(item.code == "proof_fingerprint_drift" for item in diagnostics)


def test_missing_authority_and_direct_fingerprint_edit_are_explicit_control_failures(
    tmp_path: Path,
) -> None:
    missing = _workspace(tmp_path / "missing")
    (missing / "backend/histogram.py").unlink()
    _states, diagnostics = _evaluate(missing)
    assert any(item.code == "authority_extraction_failed" for item in diagnostics)

    edited = _workspace(tmp_path / "edited")
    authority = load_json(edited / AUTHORITY_PATH)
    histogram = next(item for item in authority["components"] if item["id"] == "histogram")
    histogram["releases"][-1]["semantic_fingerprint"] = "f" * 64
    _mutate_json(edited, AUTHORITY_PATH.as_posix(), lambda value: value.update(authority))
    _states, diagnostics = _evaluate(edited)
    assert any(
        item.component == "histogram" and item.code == "semantic_drift_without_release"
        for item in diagnostics
    )
