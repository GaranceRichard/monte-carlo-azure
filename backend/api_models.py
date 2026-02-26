from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ClientContext(BaseModel):
    selected_org: Optional[str] = None
    selected_project: Optional[str] = None
    selected_team: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    done_states: List[str] = Field(default_factory=list)
    types: List[str] = Field(default_factory=list)


class SimulateRequest(BaseModel):
    throughput_samples: List[int] = Field(..., min_length=6)
    include_zero_weeks: bool = False
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[int] = Field(default=None, ge=1)
    target_weeks: Optional[int] = Field(default=None, ge=1)
    n_sims: int = Field(default=20000, ge=1000, le=200000)
    capacity_percent: int = Field(default=100, ge=1, le=100)
    client_context: Optional[ClientContext] = None


class DistributionBucket(BaseModel):
    x: int
    count: int


class SimulateResponse(BaseModel):
    result_kind: Literal["weeks", "items"]
    result_percentiles: Dict[str, int]
    risk_score: float
    result_distribution: List[DistributionBucket]
    samples_count: int


class SimulationHistoryItem(BaseModel):
    created_at: str
    last_seen: str
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[int] = None
    target_weeks: Optional[int] = None
    n_sims: int
    capacity_percent: int
    samples_count: int
    percentiles: Dict[str, int]
    distribution: List[DistributionBucket]
    selected_org: Optional[str] = None
    selected_project: Optional[str] = None
    selected_team: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    done_states: List[str] = Field(default_factory=list)
    types: List[str] = Field(default_factory=list)
    include_zero_weeks: bool = False
