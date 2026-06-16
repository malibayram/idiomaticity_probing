"""Unit tests for the paper's metrics + an end-to-end smoke test with the mock embedder."""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from idiomaticity.metrics import (  # noqa: E402
    affinity,
    cosine_sim,
    scaled_similarity,
    sim,
)


def test_cosine_basic():
    assert cosine_sim([1, 0], [1, 0]) == pytest.approx(1.0)
    assert cosine_sim([1, 0], [0, 1]) == pytest.approx(0.0)
    assert cosine_sim([1, 0], [-1, 0]) == pytest.approx(-1.0)


def test_cosine_zero_vector():
    assert cosine_sim([0, 0], [1, 1]) == 0.0


def test_sim_averages_over_substitutions():
    target = np.array([1.0, 0.0])
    same = np.array([1.0, 0.0])
    orth = np.array([0.0, 1.0])
    # mean of cos(1.0) and cos(0.0) = 0.5
    assert sim([same, orth], target) == pytest.approx(0.5)


def test_affinity_sign():
    # target prefers probe i
    assert affinity(0.9, 0.2) == pytest.approx(0.7)
    # target prefers probe j
    assert affinity(0.2, 0.9) == pytest.approx(-0.7)


def test_scaled_similarity_endpoints():
    # perfect probe -> ~1
    assert scaled_similarity(1.0, 0.3) == pytest.approx(1.0)
    # probe as bad as random -> 0
    assert scaled_similarity(0.3, 0.3) == pytest.approx(0.0)
    # halfway
    assert scaled_similarity(0.65, 0.3) == pytest.approx(0.5)


def test_scaled_similarity_degenerate():
    assert np.isnan(scaled_similarity(0.5, 1.0))


def test_end_to_end_mock():
    """The whole pipeline runs on sample data with the dependency-free mock embedder."""
    from idiomaticity.data import load_dataset
    from idiomaticity.embedders.base import build_embedder
    from idiomaticity.experiment import run, summarize_run

    data_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample"
    )
    items = load_dataset(data_dir, lang="EN", contexts=("naturalistic", "neutral"))
    assert items, "sample data should load"

    embedder = build_embedder({"name": "mock", "type": "mock", "dim": 32})
    rows = run(items, embedder, level="nc")
    assert rows

    # Every instance should yield the standard measurements.
    measurements = {r["measurement"] for r in rows}
    assert "sim_P_Syn" in measurements
    assert "aff_Syn|Rand" in measurements
    assert "simR_Syn" in measurements

    summary = summarize_run(rows)
    assert summary["groups"]
    # Sim values are valid cosines in [-1, 1].
    sims = [r["value"] for r in rows if r["measurement"] == "sim_P_Syn"]
    assert all(-1.0001 <= v <= 1.0001 for v in sims)
