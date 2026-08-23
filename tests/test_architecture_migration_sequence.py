from __future__ import annotations

import copy
import runpy
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_architecture_migration_sequence as sequence  # noqa: E402

from Scripts import (  # noqa: E402
    architecture_migration_sequence_graph as sequence_graph,
)
from Scripts import (  # noqa: E402
    architecture_migration_sequence_plan as sequence_plan,
)
from Scripts import (  # noqa: E402
    architecture_migration_sequence_validation as sequence_validation,
)


def _repository_inputs() -> tuple[dict, dict[str, tuple[str, ...]], set[str]]:
    return (
        sequence.load_plan(sequence.DEFAULT_PLAN),
        sequence.graph_from_expectations(sequence.DEFAULT_EXPECTATIONS),
        sequence.completed_from_backlog(sequence.DEFAULT_BACKLOG),
    )


def test_repository_sequence_is_acyclic_complete_and_maximally_parallel() -> None:
    plan, graph, completed = _repository_inputs()

    assert sequence.validate_sequence(plan, graph, completed) == []
    documented = sequence.documented_precedences(sequence.DEFAULT_DECISION)
    assert sequence.validate_documented_precedences(graph, documented) == []
    assert sequence.find_cycles(graph) == ()
    levels = sequence.earliest_waves(graph)
    assert len(graph) == 75
    assert max(levels.values()) == 17
    assert [identifier for identifier in sequence.MIGRATIONS if levels[identifier] == 1] == [
        "7.10",
        "7.21",
        "7.31",
        "7.32",
        "7.33",
        "7.34",
    ]


def test_cycle_is_rejected_with_its_closed_chain() -> None:
    graph = {"7.1": ("7.3",), "7.2": ("7.1",), "7.3": ("7.2",)}

    assert sequence.find_cycles(graph) == (("7.1", "7.3", "7.2", "7.1"),)


def test_a_future_wave_cannot_hide_available_parallelism() -> None:
    plan, graph, completed = _repository_inputs()
    plan = copy.deepcopy(plan)
    plan["waves"][0]["outcomes"].remove("7.34")
    plan["waves"][1]["outcomes"].append("7.34")

    errors = sequence.validate_sequence(plan, graph, completed)

    assert any("earliest publishable topological levels" in error for error in errors)


def test_a_published_state_must_include_every_predecessor() -> None:
    _plan, graph, _completed = _repository_inputs()
    incomplete_state = set(sequence.FOUNDATIONS) - {"7.7"}
    incomplete_state.add("7.10")

    errors = sequence.validate_published_state(graph, incomplete_state)

    assert "published outcome 7.8 is missing predecessors ['7.7']" in errors
    assert "published outcome 7.10 is missing predecessors ['7.7']" in errors


def test_every_outcome_belongs_to_one_parallel_lane() -> None:
    plan, graph, completed = _repository_inputs()
    plan = copy.deepcopy(plan)
    plan["lanes"][1]["outcomes"].append("7.21")

    errors = sequence.validate_sequence(plan, graph, completed)

    assert any("outcomes assigned to several lanes: ['7.21']" in error for error in errors)


def test_input_readers_reject_ambiguous_or_invalid_authorities(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    duplicate_plan = tmp_path / "duplicate.json"
    duplicate_plan.write_text('{"pbi": "7.9", "pbi": "7.10"}', encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate JSON key: pbi"):
        sequence.load_plan(duplicate_plan)

    array_plan = tmp_path / "array.json"
    array_plan.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="root must be an object"):
        sequence.load_plan(array_plan)

    expectations = tmp_path / "expectations.md"
    expectations.write_text("authority", encoding="utf-8")
    monkeypatch.setattr(
        sequence_graph,
        "parse_expectations",
        lambda _sources: ({}, ["duplicate"]),
    )
    with pytest.raises(ValueError, match="duplicate sections"):
        sequence.graph_from_expectations(expectations)

    monkeypatch.setattr(
        sequence_graph,
        "parse_expectations",
        lambda _sources: (
            {
                "6.1": SimpleNamespace(fields={}),
                "7.1": SimpleNamespace(fields={}),
            },
            [],
        ),
    )
    with pytest.raises(ValueError, match="exactly one predecessor field"):
        sequence.graph_from_expectations(expectations)

    backlog = tmp_path / "backlog.md"
    backlog.write_text("registry", encoding="utf-8")
    monkeypatch.setattr(
        sequence_graph,
        "parse_registry",
        lambda _content: ({}, {}, ["invalid"]),
    )
    with pytest.raises(ValueError, match="structurally invalid"):
        sequence.completed_from_backlog(backlog)

    monkeypatch.setattr(sequence_graph, "parse_registry", lambda _content: ({}, {}, []))
    with pytest.raises(ValueError, match="Feature 7 is absent"):
        sequence.completed_from_backlog(backlog)

    decision = tmp_path / "decision.md"
    decision.write_text("7.10 ← 7.8\n7.10 ← 7.8\n", encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate outcomes"):
        sequence.documented_precedences(decision)


def test_unresolved_graph_and_all_graph_diagnostics_are_rejected() -> None:
    with pytest.raises(ValueError, match="cyclic or unresolved migration graph"):
        sequence.earliest_waves({"7.10": ("7.11",), "7.11": ("7.10",)})

    _plan, graph, _completed = _repository_inputs()
    invalid_graph = dict(graph)
    invalid_graph.pop("7.75")
    invalid_graph["7.10"] = ("8.1",)
    invalid_graph["7.11"] = ("7.12",)
    invalid_graph["7.12"] = ("7.11",)

    errors = sequence.validate_sequence(invalid_graph, invalid_graph, set(sequence.FOUNDATIONS))

    assert any("graph coverage differs" in error for error in errors)
    assert any("unknown predecessors" in error for error in errors)
    assert any("cycle detected" in error for error in errors)


def test_plan_metadata_lanes_and_convergences_are_strictly_validated() -> None:
    plan, graph, completed = _repository_inputs()
    invalid = copy.deepcopy(plan)
    invalid.update(
        {
            "schemaVersion": "2.0.0",
            "pbi": "7.10",
            "source": "another-authority.md",
            "publicationModel": "batch",
            "rollbackModel": "forward",
            "foundations": [],
            "immediatelyParallelizable": "7.10",
            "lanes": [
                "invalid",
                {"id": "", "outcomes": "invalid"},
                {"id": "duplicate", "outcomes": ["7.11", "7.10"]},
                {"id": "duplicate", "outcomes": ["7.10", "8.1"]},
            ],
            "convergencePoints": [
                "invalid",
                {"outcome": "8.1", "role": "invalid"},
                {"outcome": "7.1", "role": ""},
                {"outcome": "7.10", "role": "first"},
                {"outcome": "7.10", "role": "second"},
            ],
        }
    )

    errors = sequence.validate_sequence(invalid, graph, completed)

    expected_fragments = (
        "schemaVersion must be 1.0.0",
        "pbi must be 7.9",
        "source must reference",
        "publicationModel must preserve",
        "rollbackModel must be reverse-topological",
        "foundations must equal",
        "immediatelyParallelizable must be an array of strings",
        "immediatelyParallelizable must equal",
        "lanes[0] must be an object",
        "lanes[1].id must be a non-empty string",
        "lanes[1].outcomes must be an array of strings",
        "lanes[2].outcomes must follow numeric PBI order",
        "duplicate lane ids",
        "outcomes assigned to several lanes",
        "lane coverage differs",
        "convergencePoints[0] must be an object",
        "convergencePoints[1].outcome must reference Feature 7",
        "convergence point 7.1 must have several direct predecessors",
        "convergencePoints[2].role must be non-empty",
        "duplicate convergence points",
    )
    for fragment in expected_fragments:
        assert any(fragment in error for error in errors)

    assert sequence_plan._validate_lanes({"lanes": None}) == ["lanes must be an array"]
    assert sequence_plan._validate_convergences(
        {"convergencePoints": None}, graph
    ) == ["convergencePoints must be an array"]


def test_documented_precedence_drift_reports_missing_and_extra_outcomes() -> None:
    _plan, graph, _completed = _repository_inputs()

    errors = sequence.validate_documented_precedences(
        graph,
        {"7.10": ("7.1",), "8.1": ()},
    )

    assert any("documented predecessors for 7.10" in error for error in errors)
    assert "documented precedence list has extra outcomes: ['8.1']" in errors


def test_cli_reports_success_validation_errors_and_unreadable_inputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert sequence.main([]) == 0
    assert "75 outcomes, 17 waves, 6 immediately parallelizable" in capsys.readouterr().out

    monkeypatch.setattr(sequence, "validate_sequence", lambda *_args: ["forced violation"])
    assert sequence.main([]) == 1
    assert "- forced violation" in capsys.readouterr().err

    missing = tmp_path / "missing.json"
    script = sequence_graph.ROOT / "Scripts" / "check_architecture_migration_sequence.py"
    monkeypatch.setattr(sys, "argv", [str(script), "--plan", str(missing)])
    with pytest.raises(SystemExit) as exc_info:
        runpy.run_path(str(script), run_name="__main__")
    assert exc_info.value.code == 2
    assert "could not run" in capsys.readouterr().err


def test_duplicate_detection_returns_every_repeated_value() -> None:
    assert sequence_validation.duplicates(["a", "b", "a", "a", "b"]) == {"a", "b"}
