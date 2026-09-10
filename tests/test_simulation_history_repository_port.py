from __future__ import annotations

import ast
from datetime import datetime, timezone
from pathlib import Path

from backend.application.history import ListSimulationHistory, RecordSimulation
from backend.ports.history import (
    SimulationHistoryEntry,
    SimulationHistoryQuery,
    SimulationHistoryToSave,
    SimulationRepository,
)
from backend.simulation_models import SimulationCommand, SimulationResult
from backend.simulation_value_objects import (
    BacklogSize,
    CompletionSummary,
    Histogram,
    SimulationCount,
    SimulationPercentiles,
    SimulationSeed,
    ThroughputReliability,
    ThroughputSamples,
)


class _ControlledSimulationRepository:
    def __init__(self, histories: tuple[SimulationHistoryEntry, ...] = ()) -> None:
        self.histories = histories
        self.saved: list[SimulationHistoryToSave] = []
        self.queries: list[SimulationHistoryQuery] = []

    def save_history(self, history: SimulationHistoryToSave) -> None:
        self.saved.append(history)

    def read_history(
        self,
        query: SimulationHistoryQuery,
    ) -> tuple[SimulationHistoryEntry, ...]:
        self.queries.append(query)
        return self.histories


def _simulation() -> tuple[SimulationCommand, SimulationResult]:
    command = SimulationCommand(
        throughput_samples=ThroughputSamples.create((1, 2, 3, 4, 5, 6), False),
        mode="backlog_to_weeks",
        backlog_size=BacklogSize(20),
        target_weeks=None,
        n_sims=SimulationCount(2_000),
        seed=SimulationSeed(123),
    )
    result = SimulationResult(
        result_kind="weeks",
        result_percentiles=SimulationPercentiles.create(
            "backlog_to_weeks",
            {"P50": 10, "P70": 12, "P90": 15},
        ),
        result_distribution=Histogram.create(
            ({"x": 10, "count": 2_000},),
            expected_mass=2_000,
        ),
        completion_summary=CompletionSummary.create(
            completed_count=2_000,
            censored_count=0,
            n_sims=SimulationCount(2_000),
        ),
        samples_count=6,
        throughput_reliability=ThroughputReliability.create(
            cv=0.2,
            iqr_ratio=0.3,
            slope_norm=0.1,
            label="fiable",
            samples_count=6,
        ),
        seed=SimulationSeed(123),
    )
    return command, result


def _history_entry() -> SimulationHistoryEntry:
    command, result = _simulation()
    assert command.backlog_size is not None
    return SimulationHistoryEntry(
        created_at=datetime(2026, 9, 10, 14, 0, tzinfo=timezone.utc),
        last_seen=datetime(2026, 9, 10, 14, 0, tzinfo=timezone.utc),
        mode=command.mode,
        backlog_size=command.backlog_size,
        target_weeks=command.target_weeks,
        n_sims=command.n_sims,
        samples_count=result.samples_count,
        percentiles=result.result_percentiles,
        risk_score=result.risk_score,
        distribution=result.result_distribution,
        completion_summary=result.completion_summary,
        include_zero_weeks=command.include_zero_weeks,
        throughput_reliability=result.throughput_reliability,
        seed=result.seed,
    )


def test_record_simulation_saves_the_internal_contract_through_the_port() -> None:
    repository = _ControlledSimulationRepository()
    command, result = _simulation()
    history = SimulationHistoryToSave("opaque-client", command, result)

    RecordSimulation(repository).execute(history)

    assert isinstance(repository, SimulationRepository)
    assert repository.saved == [history]
    assert repository.queries == []


def test_list_simulation_history_reads_internal_entries_through_the_port() -> None:
    expected = (_history_entry(),)
    repository = _ControlledSimulationRepository(expected)
    query = SimulationHistoryQuery("opaque-client")

    histories = ListSimulationHistory(repository).execute(query)

    assert histories is expected
    assert repository.queries == [query]
    assert repository.saved == []


def test_history_port_contracts_do_not_expose_mongodb_types() -> None:
    contract_modules = {
        value.__module__
        for value in (
            SimulationHistoryEntry,
            SimulationHistoryQuery,
            SimulationHistoryToSave,
            SimulationRepository,
        )
    }

    assert all("mongo" not in module.casefold() for module in contract_modules)
    assert SimulationHistoryEntry.__annotations__["created_at"] == "datetime"
    assert SimulationHistoryEntry.__annotations__["distribution"] == "Histogram"


def test_history_use_cases_depend_only_on_the_public_persistence_port() -> None:
    application_root = Path("backend/application/history")
    dependencies: set[tuple[int, str | None]] = set()
    production_sources = (
        application_root / "record_simulation.py",
        application_root / "list_simulation_history.py",
    )

    for source in production_sources:
        tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
        dependencies.update(
            (node.level, node.module)
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module != "__future__"
        )

    assert dependencies == {(3, "ports.history")}
    assert all(
        token not in source.read_text(encoding="utf-8").casefold()
        for source in production_sources
        for token in ("mongo", "bson", "simulation_store")
    )
