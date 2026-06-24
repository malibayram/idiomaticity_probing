#!/usr/bin/env python3
"""Build the article-aligned static results dataset used by Research Studio.

The draft article is the protocol source of truth.  This builder combines:

* granular NCIMP run indicators (``runs/*/indicators.csv``),
* the article's context-averaged encoder and decoder diagnostics, and
* Experiment 4 ordinary-perturbation calibration (OCG) for all 20 models.

Smoke/mock rows are deliberately excluded from the study cohort.
"""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
RUNS_DIR = REPO / "runs"
ARTICLE = REPO / "article_perturbation_calibration"
MODEL_DIAGNOSTICS = ARTICLE / "tables" / "model_diagnostics.csv"
LLM_DIAGNOSTICS = ARTICLE / "tables" / "llm_diagnostics.csv"
CALIBRATION = REPO / "experiments" / "perturbation_control" / "all_models" / "summary_table.csv"
OUT = REPO / "studio" / "public" / "results" / "run_indicators.json"

PROTOCOL_VERSION = "ncimp-ordinary-calibrated-v2"
METRICS = ["ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS"]

# The 20-model table in the current article draft.  ``year`` is study cohort
# year/type (not necessarily the checkpoint's original publication year).
MODEL_CATALOG: dict[str, dict[str, Any]] = {
    "mBERT":                 {"family": "encoder",     "cohort": "paper-era",   "experiment": 1, "year": 2024, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "DistilBERT-ML":         {"family": "encoder",     "cohort": "paper-era",   "experiment": 1, "year": 2024, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "mSBERT":                {"family": "encoder/emb", "cohort": "paper-era",   "experiment": 1, "year": 2024, "trainingStage": "base",     "representationLevel": "isolated_phrase"},
    "XLM-R-large":           {"family": "encoder",     "cohort": "2024-modern", "experiment": 1, "year": 2024, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "BGE-M3":                {"family": "encoder/emb", "cohort": "2024-modern", "experiment": 1, "year": 2024, "trainingStage": "base",     "representationLevel": "isolated_phrase"},
    "E5-large":              {"family": "encoder/emb", "cohort": "2024-modern", "experiment": 1, "year": 2024, "trainingStage": "base",     "representationLevel": "isolated_phrase"},
    "Qwen3-Emb-0.6B":        {"family": "embedding",   "cohort": "modern",      "experiment": 2, "year": 2025, "trainingStage": "base",     "representationLevel": "isolated_phrase"},
    "Qwen3-Emb-4B":          {"family": "embedding",   "cohort": "modern",      "experiment": 2, "year": 2025, "trainingStage": "base",     "representationLevel": "isolated_phrase"},
    "mE5-large-instruct":    {"family": "embedding",   "cohort": "modern",      "experiment": 2, "year": 2024, "trainingStage": "instruct", "representationLevel": "isolated_phrase"},
    "Qwen3-4B-Base":         {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2025, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "Qwen3.5-0.8B-Base":     {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "Qwen3.5-2B-it":         {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "instruct", "representationLevel": "contextual_span"},
    "Qwen3.5-4B-it":         {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "instruct", "representationLevel": "contextual_span"},
    "Qwen3.5-9B-it":         {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "instruct", "representationLevel": "contextual_span"},
    "Gemma3-1B-it":          {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2025, "trainingStage": "instruct", "representationLevel": "contextual_span"},
    "Gemma3-4B-pt":          {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2025, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "Gemma3-12B-pt":         {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2025, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "Gemma4-E2B-Base":       {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "base",     "representationLevel": "contextual_span"},
    "Gemma4-12B-it":         {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "instruct", "representationLevel": "contextual_span"},
    "Gemma4-12B-base":       {"family": "decoder LLM", "cohort": "decoder",     "experiment": 3, "year": 2026, "trainingStage": "base",     "representationLevel": "contextual_span"},
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def numeric_metrics(row: dict[str, str]) -> dict[str, float | None]:
    return {metric.lower(): to_float(row.get(metric)) for metric in METRICS}


def build_indicators() -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    run_dirs = sorted(path for path in RUNS_DIR.iterdir() if (path / "indicators.csv").exists())
    included_runs: set[str] = set()
    for run_path in run_dirs:
        for record in read_csv(run_path / "indicators.csv"):
            model = record.get("model", "")
            metadata = MODEL_CATALOG.get(model)
            if metadata is None:
                continue
            included_runs.add(run_path.name)
            rows.append({
                "run": run_path.name,
                "modelType": metadata["family"],
                "model": model,
                "lang": record.get("lang", ""),
                "context": record.get("context", ""),
                "level": record.get("level", ""),
                "representationLevel": metadata["representationLevel"],
                "cohort": metadata["cohort"],
                "studyExperiment": metadata["experiment"],
                "year": metadata["year"],
                "trainingStage": metadata["trainingStage"],
                "nIdiomatic": int(record["n_idiomatic"]) if record.get("n_idiomatic") else None,
                **numeric_metrics(record),
            })
    return rows, len(included_runs)


def build_diagnostics(indicators: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for record in read_csv(MODEL_DIAGNOSTICS):
        model = record["model"]
        metadata = MODEL_CATALOG[model]
        rows.append({
            "model": model,
            "language": record["lang"],
            "family": metadata["family"],
            "cohort": record["cohort"],
            "studyExperiment": 1,
            "year": metadata["year"],
            "trainingStage": metadata["trainingStage"],
            "representationLevel": metadata["representationLevel"],
            **numeric_metrics(record),
            "anisotropyWarning": (to_float(record.get("FLOOR")) or 0) >= 0.9,
        })
    for record in read_csv(LLM_DIAGNOSTICS):
        model = record["model"]
        metadata = MODEL_CATALOG[model]
        rows.append({
            "model": model,
            "language": "EN",
            "family": metadata["family"],
            "cohort": metadata["cohort"],
            "studyExperiment": 3,
            "year": int(record["gen"]),
            "trainingStage": metadata["trainingStage"],
            "runtime": record["type"].split("/", 1)[-1],
            "representationLevel": metadata["representationLevel"],
            **numeric_metrics(record),
            "anisotropyWarning": (to_float(record.get("FLOOR")) or 0) >= 0.9,
        })
    for model, metadata in MODEL_CATALOG.items():
        if metadata["experiment"] != 2:
            continue
        model_rows = [row for row in indicators if row["model"] == model and row["lang"] == "EN"]
        if not model_rows:
            continue
        metrics = {
            metric.lower(): sum(row[metric.lower()] for row in model_rows if row[metric.lower()] is not None)
            / len([row for row in model_rows if row[metric.lower()] is not None])
            for metric in METRICS
        }
        rows.append({
            "model": model,
            "language": "EN",
            "family": metadata["family"],
            "cohort": metadata["cohort"],
            "studyExperiment": 2,
            "year": metadata["year"],
            "trainingStage": metadata["trainingStage"],
            "representationLevel": metadata["representationLevel"],
            **metrics,
            "anisotropyWarning": (metrics["floor"] or 0) >= 0.9,
        })
    return rows


def build_calibration() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for record in read_csv(CALIBRATION):
        model = record["model"]
        metadata = MODEL_CATALOG[model]
        ordinary_gap = to_float(record["ordinary_gap"])
        unstable = ordinary_gap is not None and abs(ordinary_gap) < 0.01
        rows.append({
            "model": model,
            "language": "EN",
            "family": metadata["family"],
            "cohort": metadata["cohort"],
            "year": metadata["year"],
            "trainingStage": metadata["trainingStage"],
            "studyExperiment": 4,
            "level": "contextual_span",
            "idiomSynonym": to_float(record["idiom_syn"]),
            "idiomRandom": to_float(record["idiom_rnd"]),
            "idiomGap": to_float(record["idiom_gap"]),
            "compositionalGap": to_float(record["comp_gap"]),
            "ordinaryWordGap": to_float(record["ordword_gap"]),
            "ordinaryPhraseGap": to_float(record["ordphrase_gap"]),
            "ordinaryGap": ordinary_gap,
            "ocgIdiom": to_float(record["OCG_idiom"]),
            "ocgCompositional": to_float(record["OCG_comp"]),
            "unstable": unstable,
            "warning": "ordinary gap near zero; OCG is unstable" if unstable else None,
        })
    return rows


def main() -> None:
    indicators, run_count = build_indicators()
    diagnostics = build_diagnostics(indicators)
    calibration = build_calibration()
    catalog = [{"model": model, **metadata} for model, metadata in MODEL_CATALOG.items()]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 2,
        "protocolVersion": PROTOCOL_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "articleSource": "article_perturbation_calibration/main.tex",
        "primaryAnalysisLevel": "contextual_span",
        "thresholds": {"icsPartial": 0.55, "icsCapture": 0.70, "floorWarning": 0.90, "ocgBaseline": 1.0},
        "metrics": [metric.lower() for metric in METRICS] + ["ocg_idiom", "ocg_compositional"],
        "runCount": run_count,
        "studyModelCount": len(MODEL_CATALOG),
        "modelCatalog": catalog,
        "indicators": indicators,
        "diagnostics": diagnostics,
        "calibration": calibration,
        "methodNotes": [
            "ICS must always be interpreted together with FLOOR.",
            "Contextual span is the primary diagnostic level; full-sentence similarity is frame-dominated.",
            "OCG compares synonym-random separation with ordinary word and ordinary phrase controls.",
            "The current article calibration is English-only; Turkish OCG remains pending until the TR control set is curated and run.",
        ],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Wrote {len(indicators)} indicator rows, {len(diagnostics)} diagnostics and "
        f"{len(calibration)} calibration rows -> {OUT.relative_to(REPO)}"
    )


if __name__ == "__main__":
    main()
