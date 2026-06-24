"""Pilot selection, balanced assignment generation and gold aggregation."""

from __future__ import annotations

import hashlib
import json
import math
import random
import statistics
from collections import defaultdict
from typing import Any, Iterable


def select_stratified_pilot(
    mwes: list[dict[str, Any]],
    *,
    per_class: int = 10,
    seed: int = 20260623,
) -> list[str]:
    rng = random.Random(seed)
    selected: list[str] = []
    for label in ("I", "PC", "C"):
        candidates = [item["id"] for item in mwes if item.get("provisionalClass") == label]
        if len(candidates) < per_class:
            raise ValueError(f"{label} sınıfında {per_class} pilot item yok.")
        selected.extend(rng.sample(sorted(candidates), per_class))
    return selected


def _snapshot_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _annotation_item_snapshot(
    mwe: dict[str, Any],
    task_type: str,
    contexts: list[dict[str, Any]],
) -> dict[str, Any]:
    """Freeze only fields annotators may see; hide class and provenance."""
    return {
        "taskType": task_type,
        "mweId": mwe["id"],
        "canonicalForm": mwe["canonicalForm"],
        "modifier": mwe["modifier"],
        "head": mwe["head"],
        "meaning": mwe["meaning"],
        "contexts": [
            {
                "id": context["id"],
                "slot": context["slot"],
                "sentence": context["sentence"],
                "targetSurface": context["targetSurface"],
                "span": context["span"],
            }
            for context in contexts
        ],
    }


def generate_assignments(
    mwes: list[dict[str, Any]],
    annotator_ids: list[str],
    *,
    campaign_id: str,
    task_type: str,
    target_annotators: int = 8,
    seed: int = 20260623,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Generate balanced assignments; return assignments and quality warnings."""
    if task_type not in {"type", "token"}:
        raise ValueError("task_type type veya token olmalı.")
    if len(set(annotator_ids)) < target_annotators:
        raise ValueError(f"En az {target_annotators} tekil anotör gerekli.")
    rng = random.Random(seed)
    annotators = sorted(set(annotator_ids))
    load = defaultdict(int)
    assignments: list[dict[str, Any]] = []
    warnings: list[str] = []

    for mwe in sorted(mwes, key=lambda item: item["id"]):
        targets: list[tuple[str | None, dict[str, Any]]]
        if task_type == "type":
            contexts = [context for context in mwe["contexts"] if context["slot"] in {"S1", "S2", "S3"}]
            targets = [(None, _annotation_item_snapshot(mwe, "type", contexts))]
        else:
            targets = [
                (context["id"], _annotation_item_snapshot(mwe, "token", [context]))
                for context in mwe["contexts"]
                if context["slot"] in {"S1", "S2", "S3"}
            ]
        used_for_mwe: set[str] = set()
        for context_id, item_snapshot in targets:
            pool = [name for name in annotators if name not in used_for_mwe]
            if len(pool) < target_annotators:
                pool = annotators[:]
                warnings.append(
                    f"{mwe['id']}: token bağlamları arasında anotör tekrarını önlemek için "
                    f"en az {target_annotators * len(targets)} anotör gerekir. Yük dengeli tekrar kullanıldı."
                )
            pool.sort(key=lambda name: (load[name], rng.random()))
            chosen = pool[:target_annotators]
            used_for_mwe.update(chosen)
            digest = _snapshot_hash(item_snapshot)
            for annotator in chosen:
                suffix = context_id or "TYPE"
                assignment_id = f"{campaign_id}-{mwe['id']}-{suffix}-{annotator}"
                assignments.append(
                    {
                        "id": assignment_id,
                        "campaignId": campaign_id,
                        "assigneeId": annotator,
                        "mweId": mwe["id"],
                        "contextId": context_id,
                        "status": "assigned",
                        "itemSnapshotHash": digest,
                        "itemSnapshot": item_snapshot,
                    }
                )
                load[annotator] += 1
    return assignments, sorted(set(warnings))


def _bootstrap_ci(values: list[float], *, seed: int, samples: int = 2000) -> tuple[float, float]:
    rng = random.Random(seed)
    means = sorted(
        statistics.fmean(rng.choice(values) for _ in values)
        for _ in range(samples)
    )
    return means[int(samples * 0.025)], means[int(samples * 0.975)]


def ordinal_krippendorff_alpha(items: Iterable[list[float]]) -> float:
    groups = [values for values in items if len(values) >= 2]
    all_values = [value for group in groups for value in group]
    if not groups or len(set(all_values)) < 2:
        return float("nan")
    observed_pairs = [
        (left - right) ** 2
        for group in groups
        for index, left in enumerate(group)
        for right in group[index + 1 :]
    ]
    expected_pairs = [
        (left - right) ** 2
        for index, left in enumerate(all_values)
        for right in all_values[index + 1 :]
    ]
    observed = statistics.fmean(observed_pairs)
    expected = statistics.fmean(expected_pairs)
    return 1.0 - observed / expected if expected else float("nan")


def icc_one_way_average(items: Iterable[list[float]]) -> float:
    groups = [values for values in items if len(values) >= 2]
    if len(groups) < 2:
        return float("nan")
    k = min(len(values) for values in groups)
    groups = [values[:k] for values in groups]
    means = [statistics.fmean(values) for values in groups]
    grand = statistics.fmean(means)
    n = len(groups)
    ms_between = k * sum((mean - grand) ** 2 for mean in means) / (n - 1)
    ms_within = sum(
        sum((value - mean) ** 2 for value in values)
        for values, mean in zip(groups, means)
    ) / (n * (k - 1))
    denominator = ms_between + (k - 1) * ms_within
    return (ms_between - ms_within) / denominator if denominator else float("nan")


def aggregate_annotations(
    annotations: list[dict[str, Any]],
    assignments: list[dict[str, Any]],
) -> dict[str, Any]:
    accepted = {
        item["id"]: item
        for item in assignments
        if item.get("status") == "accepted"
    }
    by_item: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for response in annotations:
        assignment = accepted.get(response.get("assignmentId"))
        if assignment:
            by_item[(assignment["mweId"], assignment.get("contextId") or "TYPE")].append(response)

    aggregates: list[dict[str, Any]] = []
    score_groups: list[list[float]] = []
    for (mwe_id, context_id), responses in sorted(by_item.items()):
        scores = [float(item["overallScore"]) for item in responses]
        modifier = [float(item["modifierScore"]) for item in responses]
        head = [float(item["headScore"]) for item in responses]
        confidence = [float(item["confidence"]) for item in responses]
        low, high = _bootstrap_ci(scores, seed=int(hashlib.sha1(f"{mwe_id}:{context_id}".encode()).hexdigest()[:8], 16))
        score_groups.append(scores)
        aggregates.append(
            {
                "mweId": mwe_id,
                "contextId": None if context_id == "TYPE" else context_id,
                "taskType": "type" if context_id == "TYPE" else "token",
                "n": len(scores),
                "mean": statistics.fmean(scores),
                "median": statistics.median(scores),
                "stdev": statistics.stdev(scores) if len(scores) > 1 else 0.0,
                "ci95Low": low,
                "ci95High": high,
                "modifierMean": statistics.fmean(modifier),
                "headMean": statistics.fmean(head),
                "confidenceMean": statistics.fmean(confidence),
                "requiresAdjudication": len(scores) < 8 or (statistics.stdev(scores) if len(scores) > 1 else 0.0) > 1.25,
                "paraphrases": sorted({item["paraphrase"].strip() for item in responses if item.get("paraphrase", "").strip()}),
            }
        )
    alpha = ordinal_krippendorff_alpha(score_groups)
    icc = icc_one_way_average(score_groups)
    return {
        "schemaVersion": 1,
        "items": aggregates,
        "agreement": {
            "ordinalKrippendorffAlpha": None if math.isnan(alpha) else alpha,
            "iccOneWayAverage": None if math.isnan(icc) else icc,
        },
    }
