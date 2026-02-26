from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.extension import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware

from .api_config import get_api_config
from .api_routes_simulate import limiter, router, simulation_store
from .api_static import mount_frontend

app = FastAPI(title="Monte Carlo Simulate API", version="2.0")
cfg = get_api_config()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.cors_origins,
    allow_credentials=cfg.cors_allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/mongo")
def health_mongo() -> dict[str, str]:
    if not simulation_store.enabled:
        return {"status": "disabled"}
    try:
        simulation_store.ping()
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(503, "mongo_unreachable") from exc


app.include_router(router)
mount_frontend(app)
