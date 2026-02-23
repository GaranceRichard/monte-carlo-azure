from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api_config import get_api_config
from .api_routes_simulate import router
from .api_static import mount_frontend


app = FastAPI(title="Monte Carlo Simulate API", version="2.0")
cfg = get_api_config()

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


app.include_router(router)
mount_frontend(app)
