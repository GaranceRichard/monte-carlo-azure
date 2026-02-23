from __future__ import annotations

import asyncio
from typing import Any, Callable, Dict

from fastapi import APIRouter, Header, HTTPException
import numpy as np

from .api_models import ForecastRequest, ForecastResponse


def build_forecast_router(
    require_pat: Callable[[str | None], str],
    team_settings_areas: Callable[..., Dict[str, Any]],
    weekly_throughput: Callable[..., Any],
    mc_items_done_for_weeks: Callable[..., np.ndarray],
    mc_finish_weeks: Callable[..., np.ndarray],
    percentiles: Callable[..., Dict[str, int]],
    histogram_buckets: Callable[..., list[Dict[str, int]]],
    request_timeout_seconds: float | Callable[[], float] = 30.0,
) -> APIRouter:
    router = APIRouter()

    def _resolve_area_path(req: ForecastRequest, pat: str) -> str:
        org_clean = (req.org or "").strip()
        project_clean = (req.project or "").strip()

        area_path = req.area_path
        if not area_path:
            areas = team_settings_areas(req.team_name, org=org_clean, project=project_clean, pat=pat)
            area_path = areas.get("defaultValue")

        if not area_path:
            raise HTTPException(
                status_code=400,
                detail="Impossible de determiner l'AreaPath (team settings sans defaultValue).",
            )
        return area_path

    def _get_samples(req: ForecastRequest, area_path: str, pat: str) -> tuple[np.ndarray, list[Dict[str, Any]]]:
        org_clean = (req.org or "").strip()
        project_clean = (req.project or "").strip()

        weekly = weekly_throughput(
            org=org_clean,
            project=project_clean,
            area_path=area_path,
            start_date=req.start_date.isoformat(),
            end_date=req.end_date.isoformat(),
            done_states=set(req.done_states),
            work_item_types=set(req.work_item_types),
            pat=pat,
        )

        if weekly.empty:
            raise HTTPException(
                status_code=404,
                detail="Aucun item trouve avec ces filtres (area/states/types/dates).",
            )

        samples = weekly["throughput"].to_numpy()
        samples = samples[samples > 0]
        if len(samples) < 6:
            raise HTTPException(
                status_code=422,
                detail="Historique insuffisant (peu de semaines non-nulles). Elargissez la periode.",
            )

        weekly_records = weekly.assign(week=weekly["week"].astype(str)).to_dict(orient="records")
        return samples, weekly_records

    def _build_response(
        req: ForecastRequest,
        area_path: str,
        samples: np.ndarray,
        weekly_records: list[Dict[str, Any]],
    ) -> ForecastResponse:
        result_percentiles: Dict[str, int]
        result_histogram: list[Dict[str, int]]
        result_kind: str

        if req.mode == "weeks_to_items":
            if not req.target_weeks:
                raise HTTPException(
                    status_code=400,
                    detail="target_weeks requis pour le mode weeks_to_items.",
                )
            items_done = mc_items_done_for_weeks(
                weeks=req.target_weeks,
                throughput_samples=samples,
                n_sims=req.n_sims,
            )
            result_percentiles = percentiles(items_done, ps=(50, 70, 90))
            result_histogram = histogram_buckets(items_done, max_buckets=100)
            result_kind = "items"
        else:
            if not req.backlog_size:
                raise HTTPException(
                    status_code=400,
                    detail="backlog_size requis pour le mode backlog_to_weeks.",
                )
            weeks_needed = mc_finish_weeks(
                backlog_size=req.backlog_size,
                throughput_samples=samples,
                n_sims=req.n_sims,
            )
            result_percentiles = percentiles(weeks_needed, ps=(50, 70, 90))
            result_histogram = histogram_buckets(weeks_needed, max_buckets=100)
            result_kind = "weeks"

        body: Dict[str, Any] = {
            "team": req.team_name,
            "area_path": area_path,
            "mode": req.mode,
            "result_kind": result_kind,
            "samples_count": int(len(samples)),
            "result_percentiles": result_percentiles,
            "result_distribution": result_histogram,
            "result_histogram": result_histogram,
            "weekly_throughput": weekly_records,
        }

        if result_kind == "weeks":
            body["backlog_size"] = req.backlog_size
        else:
            body["target_weeks"] = req.target_weeks

        return ForecastResponse.model_validate(body)

    def _compute_forecast(req: ForecastRequest, pat: str) -> ForecastResponse:
        org_clean = (req.org or "").strip()
        project_clean = (req.project or "").strip()
        if not org_clean:
            raise HTTPException(status_code=400, detail="org requis.")
        if not project_clean:
            raise HTTPException(status_code=400, detail="project requis.")

        area_path = _resolve_area_path(req, pat)
        samples, weekly_records = _get_samples(req, area_path, pat)
        return _build_response(req, area_path, samples, weekly_records)

    @router.post("/forecast", response_model=ForecastResponse)
    async def forecast(req: ForecastRequest, x_ado_pat: str | None = Header(default=None)) -> ForecastResponse:
        pat = require_pat(x_ado_pat)
        timeout_seconds = (
            float(request_timeout_seconds()) if callable(request_timeout_seconds) else float(request_timeout_seconds)
        )
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(_compute_forecast, req, pat),
                timeout=timeout_seconds,
            )
        except TimeoutError:
            raise HTTPException(
                status_code=504,
                detail=f"Timeout /forecast apres {timeout_seconds:.0f}s. Reessayez avec une plage plus courte.",
            )

    return router
