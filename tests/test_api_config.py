from __future__ import annotations

from backend.api_config import (
    DEFAULT_CORS_ORIGINS,
    DEFAULT_RATE_LIMIT_SIMULATE,
    DEFAULT_RATE_LIMIT_STORAGE_URL,
    _parse_bool_env,
    _parse_csv_env,
    _parse_float_env,
    _parse_str_env,
    get_api_config,
)


def test_get_api_config_defaults(monkeypatch):
    monkeypatch.delenv("APP_CORS_ORIGINS", raising=False)
    monkeypatch.delenv("APP_CORS_ALLOW_CREDENTIALS", raising=False)
    monkeypatch.delenv("APP_FORECAST_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("APP_RATE_LIMIT_SIMULATE", raising=False)
    monkeypatch.delenv("APP_REDIS_URL", raising=False)

    cfg = get_api_config()
    assert cfg.cors_origins == DEFAULT_CORS_ORIGINS
    assert cfg.cors_allow_credentials is True
    assert cfg.forecast_timeout_seconds == 30.0
    assert cfg.rate_limit_simulate == DEFAULT_RATE_LIMIT_SIMULATE
    assert cfg.rate_limit_storage_url == DEFAULT_RATE_LIMIT_STORAGE_URL


def test_parse_csv_env_values_and_empty_fallback(monkeypatch):
    monkeypatch.setenv("APP_CORS_ORIGINS", " https://a.com, ,http://b.local ,, ")
    values = _parse_csv_env("APP_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    assert values == ["https://a.com", "http://b.local"]

    monkeypatch.setenv("APP_CORS_ORIGINS", "  ,   , ")
    values2 = _parse_csv_env("APP_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    assert values2 == DEFAULT_CORS_ORIGINS


def test_parse_bool_env(monkeypatch):
    monkeypatch.delenv("APP_CORS_ALLOW_CREDENTIALS", raising=False)
    assert _parse_bool_env("APP_CORS_ALLOW_CREDENTIALS", True) is True
    assert _parse_bool_env("APP_CORS_ALLOW_CREDENTIALS", False) is False

    monkeypatch.setenv("APP_CORS_ALLOW_CREDENTIALS", "true")
    assert _parse_bool_env("APP_CORS_ALLOW_CREDENTIALS", False) is True

    monkeypatch.setenv("APP_CORS_ALLOW_CREDENTIALS", "0")
    assert _parse_bool_env("APP_CORS_ALLOW_CREDENTIALS", True) is False

    monkeypatch.setenv("APP_CORS_ALLOW_CREDENTIALS", "maybe")
    assert _parse_bool_env("APP_CORS_ALLOW_CREDENTIALS", True) is False


def test_parse_float_env(monkeypatch):
    monkeypatch.delenv("APP_FORECAST_TIMEOUT_SECONDS", raising=False)
    assert _parse_float_env("APP_FORECAST_TIMEOUT_SECONDS", 30.0) == 30.0

    monkeypatch.setenv("APP_FORECAST_TIMEOUT_SECONDS", "45")
    assert _parse_float_env("APP_FORECAST_TIMEOUT_SECONDS", 30.0) == 45.0

    monkeypatch.setenv("APP_FORECAST_TIMEOUT_SECONDS", "abc")
    assert _parse_float_env("APP_FORECAST_TIMEOUT_SECONDS", 30.0) == 30.0

    monkeypatch.setenv("APP_FORECAST_TIMEOUT_SECONDS", "0")
    assert _parse_float_env("APP_FORECAST_TIMEOUT_SECONDS", 30.0) == 30.0

    monkeypatch.setenv("APP_FORECAST_TIMEOUT_SECONDS", "-10")
    assert _parse_float_env("APP_FORECAST_TIMEOUT_SECONDS", 30.0) == 30.0


def test_parse_str_env(monkeypatch):
    monkeypatch.delenv("APP_REDIS_URL", raising=False)
    assert _parse_str_env("APP_REDIS_URL", "memory://") == "memory://"

    monkeypatch.setenv("APP_REDIS_URL", "redis://redis:6379/0")
    assert _parse_str_env("APP_REDIS_URL", "memory://") == "redis://redis:6379/0"

    monkeypatch.setenv("APP_REDIS_URL", "   ")
    assert _parse_str_env("APP_REDIS_URL", "memory://") == "memory://"
