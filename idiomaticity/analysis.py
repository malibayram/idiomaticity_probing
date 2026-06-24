"""Answering the central research question, quantitatively.

Question: *Have modern AI models - which improved dramatically elsewhere - also improved at
capturing idiomaticity? If so, by how much? If not, what is the fundamental problem?*

He et al. (2025) showed 2024-era models do **not** capture idiomatic meaning. This module
turns "improvement" and "the problem" into directional, comparable indicators computed from a
``results.csv`` (the long-format output of :mod:`idiomaticity.experiment`). All indicators are
defined at the **NC level** (where idiomaticity surfaces) and per idiomaticity class
(I = idiomatic, PC = partly compositional, C = compositional).

Indicators (what an *ideal* idiomaticity-aware model would show)
----------------------------------------------------------------
ISC  Idiomatic Synonymy Capture = mean Sim_R|Syn over IDIOMATIC NCs.
     Ideal ≈ 1 (the gold synonym is recovered even for idioms). Higher = better.

IG   Idiomaticity Gap = mean Sim_R|Syn(C) − mean Sim_R|Syn(I).
     Ideal ≈ 0 (idioms handled as well as compositional). Paper: large positive. Lower = better.

LOD  Lexical-Overlap Dominance = mean over IDIOMATIC NCs of (Sim_R|WordsSyn − Sim_R|Syn).
     >0 means word-by-word literal synonyms beat the gold holistic synonym - i.e. the model
     represents the idiom as the sum of its parts. Paper: >0. Ideal <0. Lower = better.

AID  Affinity on idioms = mean A_Syn|WordsSyn over IDIOMATIC NCs.
     >0 means the model prefers the gold synonym over the literal word-synonyms (good).
     Paper: ≤0. Higher = better.

FLOOR  Random-similarity floor = mean Sim(P_Rand) at NC level.
     A high floor signals anisotropy / surface-form dominance (random replacements still look
     similar). Diagnostic, not "good/bad" on its own.

RHO  Spearman ρ(Sim_R|Syn, Comp). A model that captured idioms equally well across the
     idiomaticity spectrum would show ρ ≈ 0 (flat-high). Strong positive ρ means it only works
     for compositional NCs. |ρ| lower = better. (Subtle - reported, lightly weighted.)

ICS  Idiomaticity Capture Score ∈ [0, 1]: a single composite of the above (see weights below).
     This is a heuristic summary for ranking/▲comparison, not a claim of ground truth.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd

from .metrics import spearman_with_comp

IDIOMATIC = "I"
COMPOSITIONAL = "C"


@dataclass
class Indicators:
    model: str
    lang: str
    context: str
    level: str
    n_idiomatic: int
    ISC: float            # Idiomatic Synonymy Capture (Sim_R|Syn on idioms)  -> high good
    IG: float             # Idiomaticity Gap (C - I)                          -> ~0 good
    LOD: float            # Lexical-Overlap Dominance                         -> <0 good
    AID: float            # Affinity on idioms (A_Syn|WordsSyn)               -> >0 good
    FLOOR: float          # random-similarity floor (anisotropy proxy)        -> diagnostic
    RHO: float            # Spearman(Sim_R|Syn, Comp)                         -> |.|~0 good
    ICS: float            # composite Idiomaticity Capture Score in [0,1]

    def as_row(self) -> dict:
        return asdict(self)


def _nc_table(df: pd.DataFrame, model: str, lang: str, context: str, level: str) -> pd.DataFrame:
    """Per-NC table: rows = NC, columns = measurements (mean over the sentences)."""
    sub = df[
        (df.model == model)
        & (df.lang == lang)
        & (df.context == context)
        & (df.level == level)
    ]
    if sub.empty:
        return sub
    piv = sub.pivot_table(
        index=["nc", "comp_class", "comp_score"],
        columns="measurement",
        values="value",
        aggfunc="mean",
    ).reset_index()
    return piv


def _safe_mean(series) -> float:
    arr = pd.to_numeric(series, errors="coerce").to_numpy()
    arr = arr[~np.isnan(arr)]
    return float(arr.mean()) if arr.size else float("nan")


def compute_indicators(
    df: pd.DataFrame, model: str, lang: str, context: str, level: str = "nc"
) -> Optional[Indicators]:
    piv = _nc_table(df, model, lang, context, level)
    if piv.empty:
        return None

    idioms = piv[piv.comp_class == IDIOMATIC]
    comps = piv[piv.comp_class == COMPOSITIONAL]

    isc = _safe_mean(idioms.get("simR_Syn"))
    ig = _safe_mean(comps.get("simR_Syn")) - _safe_mean(idioms.get("simR_Syn"))
    if {"simR_WordsSyn", "simR_Syn"}.issubset(idioms.columns):
        lod = _safe_mean(idioms["simR_WordsSyn"] - idioms["simR_Syn"])
    else:
        lod = float("nan")
    aid = _safe_mean(idioms.get("aff_Syn|WordsSyn"))

    floor_src = df[
        (df.model == model) & (df.lang == lang) & (df.context == context)
        & (df.level == level) & (df.measurement == "sim_P_Rand")
    ]
    floor = _safe_mean(floor_src.value)

    # Spearman of Sim_R|Syn vs Comp across all classes with a Comp score.
    valid = piv.dropna(subset=["simR_Syn"]) if "simR_Syn" in piv.columns else piv.iloc[0:0]
    valid = valid[pd.to_numeric(valid["comp_score"], errors="coerce").notna()]
    if len(valid) >= 3:
        rho, _ = spearman_with_comp(valid["simR_Syn"], valid["comp_score"])
    else:
        rho = float("nan")

    ics = _composite_score(isc, ig, lod, aid, rho)

    return Indicators(
        model=model, lang=lang, context=context, level=level,
        n_idiomatic=int(len(idioms)),
        ISC=isc, IG=ig, LOD=lod, AID=aid, FLOOR=floor, RHO=rho, ICS=ics,
    )


def _clip01(x: float) -> float:
    return float(min(1.0, max(0.0, x)))


def _composite_score(isc, ig, lod, aid, rho) -> float:
    """Heuristic composite in [0,1]; missing components are dropped from the average."""
    parts = []
    if not np.isnan(isc):
        parts.append(_clip01(isc))                       # high good
    if not np.isnan(ig):
        parts.append(_clip01(1.0 - max(ig, 0.0)))        # gap 0 -> 1, gap 1 -> 0
    if not np.isnan(lod):
        parts.append(_clip01(0.5 - lod))                 # lod -0.5 -> 1, +0.5 -> 0
    if not np.isnan(aid):
        parts.append(_clip01(0.5 + aid))                 # aid 0 -> .5, +.5 -> 1
    if not np.isnan(rho):
        parts.append(_clip01(1.0 - abs(rho)))            # |rho| 0 -> 1
    if not parts:
        return float("nan")
    return float(np.mean(parts))


def diagnose(ind: Indicators) -> List[str]:
    """Translate the indicators into plain-language findings about *the fundamental problem*."""
    notes: List[str] = []
    if not np.isnan(ind.LOD) and ind.LOD > 0.05:
        notes.append(
            "Compositional bias: literal word-by-word synonyms are recovered better than the "
            "holistic gold synonym for idioms (LOD>0) - the model still treats the idiom as the "
            "sum of its parts."
        )
    if not np.isnan(ind.IG) and ind.IG > 0.2:
        notes.append(
            "Idiomaticity gap: idioms are handled markedly worse than compositional NCs "
            f"(IG={ind.IG:.2f}) - context is not rescuing the non-literal cases."
        )
    if not np.isnan(ind.FLOOR) and ind.FLOOR > 0.5:
        notes.append(
            f"High similarity floor (Sim(P_Rand)={ind.FLOOR:.2f}): even random replacements look "
            "similar, a sign of anisotropy / surface-form dominance in the vector space."
        )
    if not np.isnan(ind.RHO) and ind.RHO > 0.3:
        notes.append(
            f"Sim_R|Syn correlates with Comp (ρ={ind.RHO:.2f}): the model recovers synonyms well "
            "only for compositional NCs, not idiomatic ones."
        )
    if not np.isnan(ind.AID) and ind.AID <= 0:
        notes.append(
            "Wrong affinity on idioms (A_Syn|WordsSyn≤0): the model does not prefer the correct "
            "holistic synonym over literal component synonyms."
        )
    if not notes:
        notes.append("No major failure signature detected on these indicators.")
    return notes


def verdict(ind: Indicators) -> str:
    if np.isnan(ind.ICS):
        return "insufficient data"
    if ind.ICS >= 0.7:
        return "captures idiomaticity well"
    if ind.ICS >= 0.55:
        return "partial / inconsistent capture"
    return "does not capture idiomaticity"


# --------------------------------------------------------------------------------------
# Cohort comparison: old (paper) vs new (modern) models
# --------------------------------------------------------------------------------------
def indicators_table(
    df: pd.DataFrame, level: str = "nc", langs: Optional[Sequence[str]] = None,
    contexts: Optional[Sequence[str]] = None,
) -> pd.DataFrame:
    rows = []
    langs = langs or sorted(df.lang.unique())
    contexts = contexts or sorted(df.context.unique())
    for model in sorted(df.model.unique()):
        for lang in langs:
            for context in contexts:
                ind = compute_indicators(df, model, lang, context, level)
                if ind is not None:
                    rows.append(ind.as_row())
    return pd.DataFrame(rows)


def cohort_comparison(
    table: pd.DataFrame, old_models: Sequence[str], new_models: Sequence[str]
) -> Dict[str, dict]:
    """Mean indicators for the old vs new cohort + deltas (improvement = direction-aware)."""
    metrics = ["ICS", "ISC", "IG", "LOD", "AID", "FLOOR", "RHO"]
    # For each metric: +1 if higher is better, -1 if lower is better, 0 diagnostic.
    direction = {"ICS": 1, "ISC": 1, "IG": -1, "LOD": -1, "AID": 1, "FLOOR": 0, "RHO": -1}

    def cohort_mean(models):
        sub = table[table.model.isin(models)]
        return {m: float(pd.to_numeric(sub[m], errors="coerce").mean()) for m in metrics}

    old = cohort_mean(old_models)
    new = cohort_mean(new_models)
    deltas = {}
    for m in metrics:
        raw = new[m] - old[m]
        deltas[m] = {
            "old": old[m],
            "new": new[m],
            "delta": raw,
            "improved": None if direction[m] == 0 else (raw * direction[m] > 0),
        }
    return deltas
