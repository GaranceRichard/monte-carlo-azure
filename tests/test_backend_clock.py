from datetime import datetime, timezone

import backend.adapters.system.clock as system_clock_module
from backend import api_routes_simulate
from backend.adapters.system.clock import SystemUtcClock


def test_system_utc_clock_reads_datetime_in_utc(monkeypatch):
    expected = datetime(2026, 8, 23, 16, 45, tzinfo=timezone.utc)
    requested_timezones = []

    class _ControlledDateTime:
        @staticmethod
        def now(requested_timezone):
            requested_timezones.append(requested_timezone)
            return expected

    monkeypatch.setattr(system_clock_module, "datetime", _ControlledDateTime)

    assert SystemUtcClock().now() == expected
    assert requested_timezones == [timezone.utc]


def test_backend_api_composes_the_real_utc_clock():
    clock = api_routes_simulate.simulation_store._clock

    assert type(clock) is SystemUtcClock
    assert clock.now().tzinfo is timezone.utc
