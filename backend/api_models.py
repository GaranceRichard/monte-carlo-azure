from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Literal


class ForecastRequest(BaseModel):
    org: str = Field(
        ...,
        description="Nom de l'organisation Azure DevOps.",
        examples=["mon-org"],
    )
    project: str = Field(
        ...,
        description="Nom du projet Azure DevOps.",
        examples=["Mon Projet"],
    )
    team_name: str = Field(
        ...,
        description="Nom exact de l'equipe Azure DevOps.",
        examples=["Equipe Delivery"],
    )
    start_date: date = Field(
        ...,
        description="Date de debut de l'historique (format YYYY-MM-DD).",
        examples=["2024-01-01"],
    )
    end_date: date = Field(
        ...,
        description="Date de fin de l'historique (format YYYY-MM-DD).",
        examples=["2025-01-01"],
    )
    mode: Literal["backlog_to_weeks", "weeks_to_items"] = Field(
        default="backlog_to_weeks",
        description="Type de simulation: backlog_to_weeks (items vers semaines) ou weeks_to_items (semaines vers items).",
        examples=["backlog_to_weeks"],
    )
    backlog_size: Optional[int] = Field(
        default=None,
        ge=1,
        description="Nombre d'items a livrer. Requis si mode=backlog_to_weeks.",
        examples=[120],
    )
    target_weeks: Optional[int] = Field(
        default=None,
        ge=1,
        description="Nombre de semaines cible. Requis si mode=weeks_to_items.",
        examples=[12],
    )
    done_states: List[str] = Field(
        default_factory=lambda: ["Done", "Closed", "Resolved"],
        description="Etats consideres comme termines.",
        examples=[["Done", "Closed", "Resolved"]],
    )
    work_item_types: List[str] = Field(
        default_factory=lambda: ["User Story", "Product Backlog Item", "Bug"],
        description="Types de work items inclus dans le calcul du throughput.",
        examples=[["User Story", "Bug"]],
    )
    n_sims: int = Field(
        20000,
        ge=1000,
        le=200000,
        description="Nombre de simulations Monte Carlo.",
        examples=[20000],
    )
    area_path: Optional[str] = Field(
        default=None,
        description="AreaPath a utiliser. Si absent, defaultValue des settings de l'equipe est utilise.",
        examples=["Mon Projet\\Equipe A"],
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


class ForecastDistributionBucket(BaseModel):
    x: int = Field(
        ...,
        description="Valeur du bucket (semaines si result_kind=weeks, items si result_kind=items).",
        examples=[12],
    )
    count: int = Field(
        ...,
        ge=0,
        description="Nombre de simulations dans ce bucket.",
        examples=[842],
    )


class WeeklyThroughputRow(BaseModel):
    week: str = Field(
        ...,
        description="Semaine ISO (YYYY-MM-DD).",
        examples=["2025-06-09"],
    )
    throughput: int = Field(
        ...,
        ge=0,
        description="Nombre d'items termines sur la semaine.",
        examples=[7],
    )


class ForecastResponse(BaseModel):
    team: str = Field(..., description="Nom de l'equipe utilisee.", examples=["Equipe Delivery"])
    area_path: str = Field(..., description="AreaPath effectivement utilise.", examples=["Mon Projet\\Equipe A"])
    mode: Literal["backlog_to_weeks", "weeks_to_items"] = Field(
        ...,
        description="Mode de simulation execute.",
        examples=["backlog_to_weeks"],
    )
    result_kind: Literal["weeks", "items"] = Field(
        ...,
        description="Unite des resultats de simulation.",
        examples=["weeks"],
    )
    samples_count: int = Field(
        ...,
        ge=0,
        description="Nombre d'echantillons historiques non nuls utilises.",
        examples=[52],
    )
    result_percentiles: dict[str, int] = Field(
        ...,
        description="Percentiles calcules (P50/P70/P90) dans l'unite indiquee par result_kind.",
        examples=[{"P50": 14, "P70": 17, "P90": 22}],
    )
    result_distribution: List[ForecastDistributionBucket] = Field(
        ...,
        description="Distribution agregee des resultats. Si result_kind=weeks, x represente des semaines; si result_kind=items, x represente des items.",
    )
    result_histogram: List[ForecastDistributionBucket] = Field(
        ...,
        description="Alias historique de result_distribution (conserve pour compatibilite).",
    )
    weekly_throughput: List[WeeklyThroughputRow] = Field(
        ...,
        description="Serie hebdomadaire de throughput ayant servi a la simulation.",
    )
    backlog_size: Optional[int] = Field(
        default=None,
        ge=1,
        description="Backlog demande (present si mode=backlog_to_weeks).",
        examples=[120],
    )
    target_weeks: Optional[int] = Field(
        default=None,
        ge=1,
        description="Horizon en semaines (present si mode=weeks_to_items).",
        examples=[12],
    )
