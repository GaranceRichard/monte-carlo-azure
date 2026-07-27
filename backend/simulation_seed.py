import secrets

from .simulation_limits import SIMULATION_SEED_MAX
from .simulation_value_objects import SimulationSeed


def resolve_simulation_seed(requested_seed: int | None) -> SimulationSeed:
    if requested_seed is not None:
        return SimulationSeed(requested_seed)
    return SimulationSeed(secrets.randbelow(SIMULATION_SEED_MAX + 1))
