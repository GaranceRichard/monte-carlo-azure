import ast
import json
import textwrap
import warnings
from inspect import getsource, signature
from pathlib import Path

import numpy as np
import pytest

from backend.mca_prng_v1_sample_index_draw_port import (
    MCA_PRNG_V1_CONTRACT_ID,
    McaPrngV1SampleIndexDrawPort,
)
from backend.sample_index_draw_port import SampleIndexDrawPort
from backend.simulation_value_objects import SimulationSeed

_ROOT = Path(__file__).resolve().parents[1]
_CONTRACT_PATH = _ROOT / "contracts" / "mca-prng-v1-vectors.json"


def _load_contract_vectors() -> dict:
    return json.loads(_CONTRACT_PATH.read_text(encoding="utf-8"))


def _contract_vector_for_seed(contract: dict, seed: int) -> dict:
    return next(vector for vector in contract["vectors"] if vector["seed"] == seed)


def test_numpy_draw_port_matches_default_rng_across_successive_vectorized_draws():
    """Nom historique conserve pour suivre la migration de NumPy vers mca-prng-v1."""

    contract = _load_contract_vectors()
    assert contract["contractId"] == MCA_PRNG_V1_CONTRACT_ID == "mca-prng-v1"
    assert contract["version"] == 1
    assert contract["drawsPerSeed"] >= 16
    assert contract["sampleCounts"] == [
        1,
        2,
        3,
        6,
        17,
        8_589_934_592,
        9_223_372_036_854_775_808,
    ]
    assert [vector["seed"] for vector in contract["vectors"]] == [
        0,
        1,
        4_294_967_295,
        246_813_579,
    ]

    for vector in contract["vectors"]:
        raw_draw_port = McaPrngV1SampleIndexDrawPort(SimulationSeed(vector["seed"]))
        raw_values = raw_draw_port.draw_uint32(contract["drawsPerSeed"])
        assert raw_values.dtype == np.uint32
        assert np.array_equal(
            raw_values,
            np.asarray(vector["uint32"], dtype=np.uint32),
        )
        assert isinstance(raw_draw_port._state, np.uint32)

        for sample_count in contract["sampleCounts"]:
            index_draw_port = McaPrngV1SampleIndexDrawPort(
                SimulationSeed(vector["seed"])
            )
            indices = index_draw_port.draw_sample_indices(
                sample_count,
                (1, contract["drawsPerSeed"]),
            )
            assert indices.dtype == np.int64
            assert np.array_equal(
                indices.ravel(order="C"),
                np.asarray(
                    vector["sampleIndices"][str(sample_count)],
                    dtype=np.int64,
                ),
            )
            assert np.all(indices >= 0)
            assert np.all(indices < sample_count)

    row_major_vector = _contract_vector_for_seed(contract, 246_813_579)
    expected_matrix = np.asarray(
        row_major_vector["sampleIndices"]["17"],
        dtype=np.int64,
    ).reshape((4, 4), order="C")
    row_major_port = McaPrngV1SampleIndexDrawPort(
        SimulationSeed(row_major_vector["seed"])
    )
    row_major_matrix = row_major_port.draw_sample_indices(17, (4, 4))
    assert row_major_matrix.flags.c_contiguous
    assert np.array_equal(row_major_matrix, expected_matrix)

    continuity_vector = _contract_vector_for_seed(contract, 0)
    expected_continuity = np.asarray(
        continuity_vector["sampleIndices"]["6"],
        dtype=np.int64,
    )
    continuity_port = McaPrngV1SampleIndexDrawPort(
        SimulationSeed(continuity_vector["seed"])
    )
    first_matrix = continuity_port.draw_sample_indices(6, (2, 3))
    second_matrix = continuity_port.draw_sample_indices(6, (2, 5))
    assert np.array_equal(first_matrix.ravel(order="C"), expected_continuity[:6])
    assert np.array_equal(second_matrix.ravel(order="C"), expected_continuity[6:16])

    single_port = McaPrngV1SampleIndexDrawPort(SimulationSeed(1))
    split_port = McaPrngV1SampleIndexDrawPort(SimulationSeed(1))
    single_draw = single_port.draw_sample_indices(17, (4, 4)).ravel(order="C")
    split_draws = np.concatenate(
        [
            split_port.draw_sample_indices(17, (1, 3)).ravel(order="C"),
            split_port.draw_sample_indices(17, (1, 5)).ravel(order="C"),
            split_port.draw_sample_indices(17, (2, 4)).ravel(order="C"),
        ]
    )
    assert np.array_equal(split_draws, single_draw)

    representative_port = McaPrngV1SampleIndexDrawPort(
        SimulationSeed(4_294_967_295)
    )
    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        representative = representative_port.draw_sample_indices(
            521,
            (2048, 521),
        )
    assert representative.shape == (2048, 521)
    assert representative.dtype == np.int64
    assert int(representative.min()) >= 0
    assert int(representative.max()) < 521

    for invalid_draw_count in (0, -1, 1.5, True, None):
        with pytest.raises(ValueError, match="draw_count"):
            McaPrngV1SampleIndexDrawPort(SimulationSeed(1)).draw_uint32(
                invalid_draw_count
            )

    transition_source = textwrap.dedent(
        getsource(McaPrngV1SampleIndexDrawPort._draw_uint32_values)
    )
    transition_tree = ast.parse(transition_source)
    assert "np.arange" in transition_source
    assert not any(
        isinstance(node, (ast.For, ast.While))
        for node in ast.walk(transition_tree)
    )
    assert "_draw_uint32_values" in getsource(
        McaPrngV1SampleIndexDrawPort.draw_uint32
    )
    assert "_draw_uint32_values" in getsource(
        McaPrngV1SampleIndexDrawPort.draw_sample_indices
    )

    production_sources = {
        path: path.read_text(encoding="utf-8")
        for path in (_ROOT / "backend").glob("*.py")
    }
    for forbidden in ("default_rng", "np.random", "Generator"):
        assert all(forbidden not in source for source in production_sources.values())
    transition_paths = [
        path
        for path, source in production_sources.items()
        if "0x6D2B79F5" in source
    ]
    assert transition_paths == [
        _ROOT / "backend" / "mca_prng_v1_sample_index_draw_port.py"
    ]

    assert tuple(signature(SampleIndexDrawPort.draw_sample_indices).parameters) == (
        "self",
        "sample_count",
        "shape",
    )
    assert tuple(
        signature(McaPrngV1SampleIndexDrawPort.draw_sample_indices).parameters
    ) == (
        "self",
        "sample_count",
        "shape",
    )
    assert McaPrngV1SampleIndexDrawPort.__slots__ == ("_state",)


@pytest.mark.parametrize("sample_count", [0, -1, 1.5, True])
def test_numpy_draw_port_rejects_invalid_sample_count(sample_count):
    draw_port = McaPrngV1SampleIndexDrawPort(SimulationSeed(1))

    with pytest.raises(ValueError, match="sample_count"):
        draw_port.draw_sample_indices(sample_count, (1, 1))
    for invalid in (None, float("nan"), float("inf"), "6", 2**63 + 1):
        with pytest.raises(ValueError, match="sample_count"):
            draw_port.draw_sample_indices(invalid, (1, 1))


@pytest.mark.parametrize(
    "shape",
    [
        [1, 1],
        (1,),
        (1, 1, 1),
        (0, 1),
        (1, -1),
        (1.5, 1),
        (True, 1),
    ],
)
def test_numpy_draw_port_rejects_invalid_vectorized_shape(shape):
    draw_port = McaPrngV1SampleIndexDrawPort(SimulationSeed(1))

    with pytest.raises(ValueError, match="shape"):
        draw_port.draw_sample_indices(1, shape)
