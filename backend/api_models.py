from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Literal


class ForecastRequest(BaseModel):
    org: str = Field(..., description="Organisation Azure DevOps")
    project: str = Field(..., description="Projet Azure DevOps")
    team_name: str = Field(..., description="Nom exact de la team")
    start_date: date = Field(..., description="YYYY-MM-DD")
    end_date: date = Field(..., description="YYYY-MM-DD")
    mode: Literal["backlog_to_weeks", "weeks_to_items"] = Field(
        default="backlog_to_weeks",
        description="Mode de simulation: backlog_to_weeks ou weeks_to_items",
    )
    backlog_size: Optional[int] = Field(default=None, ge=1)
    target_weeks: Optional[int] = Field(default=None, ge=1)
    done_states: List[str] = Field(
        default_factory=lambda: ["Done", "Closed", "Resolved"]
    )
    work_item_types: List[str] = Field(
        default_factory=lambda: ["User Story", "Product Backlog Item", "Bug"]
    )
    n_sims: int = Field(20000, ge=1000, le=200000)
    area_path: Optional[str] = Field(
        default=None,
        description="AreaPath a utiliser. Si absent, on prend defaultValue des settings de team.",
    )

    @model_validator(mode="after")
    def validate_date_range(self) -> "ForecastRequest":
        if self.start_date >= self.end_date:
            raise ValueError("start_date doit etre strictement avant end_date.")
        return self


class OrgRequest(BaseModel):
    org: str = Field(..., description="Nom de l'organisation Azure DevOps")


class OrgProjectRequest(BaseModel):
    org: str = Field(..., description="Nom de l'organisation Azure DevOps")
    project: str = Field(..., description="Nom du projet Azure DevOps")


class TeamOptionsRequest(BaseModel):
    org: str = Field(..., description="Nom de l'organisation Azure DevOps")
    project: str = Field(..., description="Nom du projet Azure DevOps")
    team: str = Field(..., description="Nom de l'equipe Azure DevOps")
