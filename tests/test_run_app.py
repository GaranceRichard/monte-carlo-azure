from __future__ import annotations

import run_app


def test_configure_event_loop_policy_noop_outside_windows(monkeypatch):
    calls: list[object] = []

    def set_policy(policy):
        calls.append(policy)

    monkeypatch.setattr(run_app.sys, "platform", "linux")
    monkeypatch.setattr(run_app.asyncio, "set_event_loop_policy", set_policy)

    run_app.configure_event_loop_policy()

    assert calls == []


def test_configure_event_loop_policy_sets_windows_selector_policy(monkeypatch):
    calls: list[object] = []

    def set_policy(policy):
        calls.append(policy)

    class _FakePolicy:
        pass

    monkeypatch.setattr(run_app.sys, "platform", "win32")
    monkeypatch.setattr(
        run_app.asyncio,
        "WindowsSelectorEventLoopPolicy",
        _FakePolicy,
        raising=False,
    )
    monkeypatch.setattr(run_app.asyncio, "set_event_loop_policy", set_policy)

    run_app.configure_event_loop_policy()

    assert len(calls) == 1
    assert isinstance(calls[0], _FakePolicy)
