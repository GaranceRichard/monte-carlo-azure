from __future__ import annotations

import sys

import pytest

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


def test_configure_event_loop_policy_handles_missing_windows_policy(monkeypatch):
    monkeypatch.setattr(run_app.sys, "platform", "win32")
    monkeypatch.delattr(run_app.asyncio, "WindowsSelectorEventLoopPolicy", raising=False)
    run_app.configure_event_loop_policy()


def test_is_port_free_reports_socket_result(monkeypatch):
    class FakeSocket:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def settimeout(self, value):
            self.timeout = value

        def connect_ex(self, address):
            self.address = address
            return 1

    sock = FakeSocket()
    monkeypatch.setattr(run_app.socket, "socket", lambda *_args: sock)
    assert run_app.is_port_free("localhost", 8000)
    assert sock.timeout == 0.25
    assert sock.address == ("localhost", 8000)


def test_main_runs_server_and_optional_browser(monkeypatch):
    calls: list[tuple] = []

    class Uvicorn:
        @staticmethod
        def run(*args, **kwargs):
            calls.append((args, kwargs))

    monkeypatch.setitem(sys.modules, "uvicorn", Uvicorn)
    monkeypatch.setattr(run_app, "is_port_free", lambda *_args: True)
    monkeypatch.setattr(run_app.webbrowser, "open", lambda url: calls.append((url, {})))
    monkeypatch.setattr(sys, "argv", ["run_app.py", "--host", "0.0.0.0", "--port", "9000"])
    run_app.main()
    assert calls[0][0] == "http://0.0.0.0:9000/"
    assert calls[1][1]["port"] == 9000

    calls.clear()
    monkeypatch.setattr(sys, "argv", ["run_app.py", "--no-browser"])
    run_app.main()
    assert len(calls) == 1


def test_main_rejects_an_occupied_port(monkeypatch):
    monkeypatch.setattr(run_app, "is_port_free", lambda *_args: False)
    monkeypatch.setattr(sys, "argv", ["run_app.py", "--port", "8123"])
    with pytest.raises(SystemExit, match="Port 8123"):
        run_app.main()
