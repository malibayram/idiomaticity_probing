"""The paper's metrics (Section 3.4).

All functions operate on numpy vectors / arrays and are model-independent.

    cosine_sim(x, y)                         Eq. 2
    sim(probe_vecs, target_vec)              Eq. 3  (mean cosine over substitutions)
    affinity(sim_i, sim_j)                   Eq. 4  Aff(Pi, Pj | Target)
    scaled_similarity(sim_i, sim_rand)       Eq. 5  Sim_R(Pi | Target)
    spearman_with_comp(values, comp)         Eq. 1 correlation (ρ)

Key derived quantities used throughout the paper:
    A_Syn|WordsSyn = affinity(Sim(P_Syn), Sim(P_WordsSyn))
    A_Syn|Rand     = affinity(Sim(P_Syn), Sim(P_Rand))
    Sim_R|Syn      = scaled_similarity(Sim(P_Syn), Sim(P_Rand))
    Sim_R|WordsSyn = scaled_similarity(Sim(P_WordsSyn), Sim(P_Rand))
"""

from __future__ import annotations

from typing import Iterable, Sequence

import numpy as np


# ----------------------------------------------------------------------------------------
# Eq. 2 — cosine similarity
# ----------------------------------------------------------------------------------------
def cosine_sim(x: np.ndarray, y: np.ndarray, eps: float = 1e-12) -> float:
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    nx = np.linalg.norm(x)
    ny = np.linalg.norm(y)
    if nx < eps or ny < eps:
        return 0.0
    return float(np.dot(x, y) / (nx * ny))


# ----------------------------------------------------------------------------------------
# Eq. 3 — Sim(Pi, Target): mean cosine over the probe's substitutions
# ----------------------------------------------------------------------------------------
def sim(probe_vectors: Sequence[np.ndarray], target_vector: np.ndarray) -> float:
    """Average cosine similarity between the target representation and the probe-modified
    representation(s). ``P_Rand`` supplies several substitutions; others a single one."""
    cosines = [cosine_sim(v, target_vector) for v in probe_vectors]
    if not cosines:
        return float("nan")
    return float(np.mean(cosines))


# ----------------------------------------------------------------------------------------
# Eq. 4 — Affinity
# ----------------------------------------------------------------------------------------
def affinity(sim_i: float, sim_j: float) -> float:
    """Aff(Pi, Pj | Target) = Sim(Pi, Target) - Sim(Pj, Target).

    ~+1: target prefers probe i; ~-1: prefers probe j; ~0: no preference.
    """
    return float(sim_i - sim_j)


# ----------------------------------------------------------------------------------------
# Eq. 5 — Scaled Similarity (max-min normalization against the random lower bound)
# ----------------------------------------------------------------------------------------
def scaled_similarity(sim_i: float, sim_rand: float, eps: float = 1e-12) -> float:
    """Sim_R(Pi | Target) = (Sim(Pi) - Sim(P_Rand)) / (1 - Sim(P_Rand)).

    ~1 if probe is near-perfect; ~0 if it is as bad as a random replacement.
    """
    denom = 1.0 - sim_rand
    if abs(denom) < eps:
        return float("nan")
    return float((sim_i - sim_rand) / denom)


# ----------------------------------------------------------------------------------------
# Eq. 1 correlation — Spearman ρ between a measurement and human Comp
# ----------------------------------------------------------------------------------------
def spearman_with_comp(values: Iterable[float], comp: Iterable[float]):
    """Spearman correlation between per-NC measurements and human Comp scores.

    Returns ``(rho, p_value)``; NaN pairs are dropped. Requires scipy.
    """
    from scipy.stats import spearmanr

    v = np.asarray(list(values), dtype=np.float64)
    c = np.asarray(list(comp), dtype=np.float64)
    mask = ~(np.isnan(v) | np.isnan(c))
    if mask.sum() < 3:
        return float("nan"), float("nan")
    rho, p = spearmanr(v[mask], c[mask])
    return float(rho), float(p)


# ----------------------------------------------------------------------------------------
# Aggregation helper
# ----------------------------------------------------------------------------------------
def summarize(values: Sequence[float]) -> dict:
    """mean / std / median / n over a list of values (NaNs ignored)."""
    arr = np.asarray([v for v in values if v is not None], dtype=np.float64)
    arr = arr[~np.isnan(arr)]
    if arr.size == 0:
        return {"mean": float("nan"), "std": float("nan"), "median": float("nan"), "n": 0}
    return {
        "mean": float(arr.mean()),
        "std": float(arr.std()),
        "median": float(np.median(arr)),
        "n": int(arr.size),
    }
