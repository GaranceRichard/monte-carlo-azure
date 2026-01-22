import os
from datetime import date, timedelta

import numpy as np
import matplotlib.pyplot as plt

from backend.ado_core import team_settings_areas, weekly_throughput
from backend.mc_core import mc_finish_weeks, percentiles


# -----------------------------
# PARAMETRES A AJUSTER
# -----------------------------
START_DATE = "2025-10-01"   # fenêtre historique
END_DATE   = "2026-01-19"

DONE_STATES = {"Done", "Closed", "Resolved"}  # adaptez à vos états finaux
WORK_ITEM_TYPES = {"User Story", "Product Backlog Item", "Bug"}  # adaptez à vos types

BACKLOG_SIZE = 120
FORECAST_START = date(2026, 1, 19)

N_SIMS = 20000
SEED = 42


def resolve_area_path() -> str:
    """
    Priorité:
      1) ADO_AREA_PATH dans .env
      2) defaultValue des team settings de ADO_TEAM
    """
    area = (os.getenv("ADO_AREA_PATH") or "").strip()
    if area:
        return area

    team = (os.getenv("ADO_TEAM") or "").strip()
    if not team:
        raise RuntimeError("ADO_TEAM manquant (et ADO_AREA_PATH absent). Ajoutez ADO_TEAM=... dans .env")

    areas = team_settings_areas(team)
    area = (areas.get("defaultValue") or "").strip()
    if not area:
        raise RuntimeError("Impossible de résoudre l'AreaPath (pas de defaultValue dans team settings).")
    return area


def weeks_to_date(start: date, weeks: int) -> date:
    return start + timedelta(days=7 * weeks)


if __name__ == "__main__":
    team = (os.getenv("ADO_TEAM") or "").strip() or "(non défini)"
    area_path = resolve_area_path()

    print("TEAM      :", team)
    print("AREA_PATH :", area_path)
    print("PERIODE   :", START_DATE, "->", END_DATE)
    print()

    weekly = weekly_throughput(
        area_path=area_path,
        start_date=START_DATE,
        end_date=END_DATE,
        done_states=DONE_STATES,
        work_item_types=WORK_ITEM_TYPES,
    )

    if weekly.empty:
        print("Aucun item trouvé. Vérifiez DONE_STATES / WORK_ITEM_TYPES / dates / area path.")
        raise SystemExit(1)

    print("Throughput hebdo (10 dernières lignes):")
    print(weekly.tail(10).to_string(index=False))

    samples = weekly["throughput"].to_numpy()
    samples = samples[samples > 0]
    if len(samples) < 6:
        print("\nHistorique insuffisant (peu de semaines non-nulles). Élargissez START_DATE/END_DATE.")
        raise SystemExit(1)

    weeks_needed = mc_finish_weeks(
        backlog_size=BACKLOG_SIZE,
        throughput_samples=samples,
        n_sims=N_SIMS,
        seed=SEED,
    )
    p = percentiles(weeks_needed, ps=(50, 80, 90))

    print("\nMonte Carlo (semaines nécessaires):", p)
    print("Dates estimées (à partir de FORECAST_START):")
    for k in ["P50", "P80", "P90"]:
        w = p[k]
        print(f"{k}: {w} semaines -> {weeks_to_date(FORECAST_START, w)}")

    # Histogramme
    plt.figure()
    plt.hist(weeks_needed, bins=30)
    plt.xlabel("Semaines nécessaires")
    plt.ylabel("Fréquence")
    plt.title("Monte Carlo - distribution des semaines nécessaires")
    plt.show()
