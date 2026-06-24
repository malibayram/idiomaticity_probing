"""Experiment orchestration: run probes + metrics for a model over the dataset.

For each :class:`NCInstance` we embed the original NC/sentence and every probe substitution,
compute ``Sim`` per probe (Eq. 3), then the derived Affinity (Eq. 4) and Scaled Similarity
(Eq. 5). Per-NC aggregation (over the naturalistic S1–S3 sentences) feeds the Spearman
correlation with the human Comp score (Eq. 1 correlation).

Granularity (``level``):
  * ``"sentence"`` - embed whole sentences (Figure 1 in the paper)
  * ``"nc"``       - embed only the target NC / probe tokens in context (Figure 2)

Outputs a long-format ``list[dict]`` (one row per instance × measurement) that can be written
to CSV and summarized.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Sequence

import numpy as np

from .data import NCInstance, Substitution
from .embedders.base import BaseEmbedder
from .metrics import (
    affinity,
    scaled_similarity,
    sim,
    spearman_with_comp,
    summarize,
)
from .probes import PROBE_ORDER, Probe


class EmbeddingCache:
    """Caches embeddings keyed by (sentence, span, level) so repeated text is encoded once."""

    def __init__(self, embedder: BaseEmbedder):
        self.embedder = embedder
        self._cache: Dict[tuple, np.ndarray] = {}

    def get(self, sub: Substitution, level: str) -> np.ndarray:
        span = None if level == "sentence" else sub.span
        key = (sub.sentence, span)
        if key not in self._cache:
            self._cache[key] = self.embedder.embed(sub.sentence, span)
        return self._cache[key]


def evaluate_instance(
    inst: NCInstance, cache: EmbeddingCache, level: str
) -> Dict[str, float]:
    """Compute Sim for every probe + derived Affinity / Scaled Similarity for one instance."""
    target = cache.get(inst.original, level)
    sims: Dict[Probe, float] = {}
    for probe in PROBE_ORDER:
        subs = inst.probe_subs(probe)
        if not subs:
            continue
        vecs = [cache.get(s, level) for s in subs]
        sims[probe] = sim(vecs, target)

    out: Dict[str, float] = {f"sim_{p.value}": v for p, v in sims.items()}

    s_syn = sims.get(Probe.SYN, np.nan)
    s_words = sims.get(Probe.WORDS_SYN, np.nan)
    s_rand = sims.get(Probe.RAND, np.nan)

    out["aff_Syn|WordsSyn"] = affinity(s_syn, s_words)
    out["aff_Syn|Rand"] = affinity(s_syn, s_rand)
    out["simR_Syn"] = scaled_similarity(s_syn, s_rand)
    out["simR_WordsSyn"] = scaled_similarity(s_words, s_rand)
    return out


#: Measurement columns produced per instance, in report order.
MEASUREMENTS = [
    "sim_P_Syn",
    "sim_P_Comp",
    "sim_P_WordsSyn",
    "sim_P_Rand",
    "aff_Syn|WordsSyn",
    "aff_Syn|Rand",
    "simR_Syn",
    "simR_WordsSyn",
]


def run(
    items: Sequence[NCInstance],
    embedder: BaseEmbedder,
    level: str = "nc",
    progress: bool = False,
) -> List[dict]:
    """Evaluate ``embedder`` over ``items`` at the given ``level``; return long-format rows."""
    cache = EmbeddingCache(embedder)
    rows: List[dict] = []
    iterator = enumerate(items)
    for i, inst in iterator:
        if progress and i % 25 == 0:
            print(f"  [{embedder.name}] {i}/{len(items)}", flush=True)
        measures = evaluate_instance(inst, cache, level)
        base = {
            "model": embedder.name,
            "lang": inst.lang,
            "context": inst.context,
            "level": level,
            "nc": inst.nc,
            "comp_class": inst.comp_class,
            "comp_score": inst.comp_score,
            "sent_id": inst.sent_id,
        }
        for key, value in measures.items():
            rows.append({**base, "measurement": key, "value": value})
    return rows


def aggregate_per_nc(rows: Sequence[dict], measurement: str) -> Dict[str, float]:
    """Mean of a measurement per NC (averaging over the S1–S3 naturalistic sentences)."""
    by_nc: Dict[str, List[float]] = defaultdict(list)
    comp: Dict[str, float] = {}
    for r in rows:
        if r["measurement"] != measurement:
            continue
        v = r["value"]
        if v is not None and not (isinstance(v, float) and np.isnan(v)):
            by_nc[r["nc"]].append(v)
        if r["comp_score"] is not None:
            comp[r["nc"]] = r["comp_score"]
    return {nc: float(np.mean(vs)) for nc, vs in by_nc.items() if vs}


def summarize_run(rows: Sequence[dict]) -> dict:
    """Build a summary: mean/std of each measurement + Spearman ρ with Comp (Table 2/6 style).

    Grouped by (model, lang, context, level).
    """
    groups: Dict[tuple, List[dict]] = defaultdict(list)
    for r in rows:
        groups[(r["model"], r["lang"], r["context"], r["level"])].append(r)

    summary = []
    for (model, lang, context, level), grp in groups.items():
        entry = {
            "model": model,
            "lang": lang,
            "context": context,
            "level": level,
            "measurements": {},
        }
        for m in MEASUREMENTS:
            vals = [r["value"] for r in grp if r["measurement"] == m]
            stats = summarize(vals)
            # Spearman of the per-NC mean vs Comp (only meaningful where Comp exists).
            per_nc = aggregate_per_nc(grp, m)
            comp_map = {
                r["nc"]: r["comp_score"]
                for r in grp
                if r["comp_score"] is not None
            }
            common = [nc for nc in per_nc if nc in comp_map]
            if len(common) >= 3:
                rho, p = spearman_with_comp(
                    [per_nc[nc] for nc in common],
                    [comp_map[nc] for nc in common],
                )
            else:
                rho, p = float("nan"), float("nan")
            stats["spearman_comp"] = rho
            stats["spearman_p"] = p
            entry["measurements"][m] = stats
        summary.append(entry)
    return {"groups": summary}
