from __future__ import annotations

import sys
from types import SimpleNamespace

from pymongo.errors import PyMongoError

from Scripts import scrub_simulation_identity


class _FakeUpdateResult:
    def __init__(self, modified_count: int) -> None:
        self.modified_count = modified_count


class _FakeCollection:
    def __init__(self, count: int = 0) -> None:
        self.count = count
        self.count_filters: list[dict] = []
        self.update_calls: list[tuple[dict, dict]] = []

    def count_documents(self, query: dict) -> int:
        self.count_filters.append(query)
        return self.count

    def update_many(self, query: dict, update: dict) -> _FakeUpdateResult:
        self.update_calls.append((query, update))
        return _FakeUpdateResult(modified_count=self.count)


class _FakeDatabase:
    def __init__(self, collection: _FakeCollection) -> None:
        self.collection = collection

    def __getitem__(self, _name: str) -> _FakeCollection:
        return self.collection


class _FakeMongoClient:
    def __init__(self, collection: _FakeCollection) -> None:
        self.collection = collection
        self.closed = False

    def __getitem__(self, _name: str) -> _FakeDatabase:
        return _FakeDatabase(self.collection)

    def close(self) -> None:
        self.closed = True


def test_build_unset_payload_contains_all_sensitive_fields():
    unset_payload = scrub_simulation_identity.build_unset_payload()

    assert set(unset_payload) == set(scrub_simulation_identity.SENSITIVE_FIELDS)
    assert unset_payload["selected_team"] == ""
    assert unset_payload["azure_devops_url"] == ""


def test_scrub_sensitive_documents_detects_documents_without_modifying_in_dry_run():
    collection = _FakeCollection(count=3)

    matched, modified = scrub_simulation_identity.scrub_sensitive_documents(
        collection,
        apply_changes=False,
    )

    assert matched == 3
    assert modified == 0
    assert collection.update_calls == []


def test_scrub_sensitive_documents_applies_expected_unset_payload():
    collection = _FakeCollection(count=2)

    matched, modified = scrub_simulation_identity.scrub_sensitive_documents(
        collection,
        apply_changes=True,
    )

    assert matched == 2
    assert modified == 2
    assert collection.update_calls == [
        (
            scrub_simulation_identity.build_sensitive_filter(),
            {"$unset": scrub_simulation_identity.build_unset_payload()},
        )
    ]


def test_scrub_sensitive_documents_is_idempotent_when_nothing_matches():
    collection = _FakeCollection(count=0)

    matched, modified = scrub_simulation_identity.scrub_sensitive_documents(
        collection,
        apply_changes=True,
    )

    assert matched == 0
    assert modified == 0
    assert collection.update_calls == []


def test_main_returns_non_zero_on_mongo_error(monkeypatch, capsys):
    monkeypatch.setattr(
        scrub_simulation_identity,
        "parse_args",
        lambda: SimpleNamespace(apply=False),
    )
    monkeypatch.setattr(
        scrub_simulation_identity,
        "get_api_config",
        lambda: SimpleNamespace(
            mongo_url="mongodb://localhost:27017",
            mongo_db="montecarlo",
            mongo_collection_simulations="simulations",
            mongo_server_selection_timeout_ms=1000,
            mongo_connect_timeout_ms=1000,
            mongo_socket_timeout_ms=1000,
        ),
    )

    def _broken_client(*_args, **_kwargs):
        raise PyMongoError("boom")

    monkeypatch.setattr(scrub_simulation_identity, "MongoClient", _broken_client)

    assert scrub_simulation_identity.main() == 1
    assert "Mongo error" in capsys.readouterr().out


def test_main_reports_dry_run(monkeypatch, capsys):
    collection = _FakeCollection(count=4)
    client = _FakeMongoClient(collection)
    monkeypatch.setattr(
        scrub_simulation_identity,
        "parse_args",
        lambda: SimpleNamespace(apply=False),
    )
    monkeypatch.setattr(
        scrub_simulation_identity,
        "get_api_config",
        lambda: SimpleNamespace(
            mongo_url="mongodb://localhost:27017",
            mongo_db="montecarlo",
            mongo_collection_simulations="simulations",
            mongo_server_selection_timeout_ms=1000,
            mongo_connect_timeout_ms=1000,
            mongo_socket_timeout_ms=1000,
        ),
    )
    monkeypatch.setattr(scrub_simulation_identity, "MongoClient", lambda *_args, **_kwargs: client)

    assert scrub_simulation_identity.main() == 0
    output = capsys.readouterr().out
    assert "mode=dry-run" in output
    assert "matched_documents=4" in output
    assert "modified_documents=0" in output
    assert client.closed is True


def test_main_reports_apply(monkeypatch, capsys):
    collection = _FakeCollection(count=2)
    client = _FakeMongoClient(collection)
    monkeypatch.setattr(
        scrub_simulation_identity,
        "parse_args",
        lambda: SimpleNamespace(apply=True),
    )
    monkeypatch.setattr(
        scrub_simulation_identity,
        "get_api_config",
        lambda: SimpleNamespace(
            mongo_url="mongodb://localhost:27017",
            mongo_db="montecarlo",
            mongo_collection_simulations="simulations",
            mongo_server_selection_timeout_ms=1000,
            mongo_connect_timeout_ms=1000,
            mongo_socket_timeout_ms=1000,
        ),
    )
    monkeypatch.setattr(scrub_simulation_identity, "MongoClient", lambda *_args, **_kwargs: client)

    assert scrub_simulation_identity.main() == 0
    output = capsys.readouterr().out
    assert "mode=apply" in output
    assert "modified_documents=2" in output
    assert collection.update_calls


def test_parse_args_and_disabled_mongo(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["scrub_simulation_identity.py", "--apply"])
    assert scrub_simulation_identity.parse_args().apply is True
    monkeypatch.setattr(
        scrub_simulation_identity,
        "parse_args",
        lambda: SimpleNamespace(apply=False),
    )
    monkeypatch.setattr(
        scrub_simulation_identity,
        "get_api_config",
        lambda: SimpleNamespace(mongo_url=""),
    )
    assert scrub_simulation_identity.main() == 1
    assert "Mongo disabled" in capsys.readouterr().out


def test_main_closes_client_when_collection_operation_fails(monkeypatch, capsys):
    class BrokenClient(_FakeMongoClient):
        def __getitem__(self, _name: str):
            raise PyMongoError("operation")

    client = BrokenClient(_FakeCollection())
    monkeypatch.setattr(
        scrub_simulation_identity,
        "parse_args",
        lambda: SimpleNamespace(apply=False),
    )
    monkeypatch.setattr(
        scrub_simulation_identity,
        "get_api_config",
        lambda: SimpleNamespace(
            mongo_url="mongodb://localhost:27017",
            mongo_db="montecarlo",
            mongo_collection_simulations="simulations",
            mongo_server_selection_timeout_ms=1000,
            mongo_connect_timeout_ms=1000,
            mongo_socket_timeout_ms=1000,
        ),
    )
    monkeypatch.setattr(scrub_simulation_identity, "MongoClient", lambda *_a, **_k: client)
    assert scrub_simulation_identity.main() == 1
    assert client.closed is True
    assert "Mongo error" in capsys.readouterr().out
