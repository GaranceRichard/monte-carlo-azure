from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
DEFAULT_RATE_LIMIT_SIMULATE = "20/minute"
DEFAULT_RATE_LIMIT_STORAGE_URL = "memory://"


def _parse_csv_env(name: str, default: list[str]) -> list[str]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    values = [v.strip() for v in raw.split(",")]
    values = [v for v in values if v]
    return values or default


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _parse_str_env(name: str, default: str) -> str:
    raw = (os.getenv(name) or "").strip()
    return raw or default


@dataclass(frozen=True)
class ApiConfig:
    cors_origins: list[str]
    cors_allow_credentials: bool
    forecast_timeout_seconds: float
    rate_limit_simulate: str
    rate_limit_storage_url: str


def _parse_float_env(name: str, default: float) -> float:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def get_api_config() -> ApiConfig:
    return ApiConfig(
        cors_origins=_parse_csv_env("APP_CORS_ORIGINS", DEFAULT_CORS_ORIGINS),
        cors_allow_credentials=_parse_bool_env("APP_CORS_ALLOW_CREDENTIALS", True),
        forecast_timeout_seconds=_parse_float_env("APP_FORECAST_TIMEOUT_SECONDS", 30.0),
        rate_limit_simulate=_parse_str_env("APP_RATE_LIMIT_SIMULATE", DEFAULT_RATE_LIMIT_SIMULATE),
        rate_limit_storage_url=_parse_str_env("APP_REDIS_URL", DEFAULT_RATE_LIMIT_STORAGE_URL),
    )
