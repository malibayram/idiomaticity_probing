#!/usr/bin/env python3
"""Run the ordinary-perturbation control on ALL 20 models via the idiomaticity framework.

For each model and each example, we replace the target phrase with each variant and measure
cosine similarity at three levels (sentence / contextual-span / isolated-phrase), exactly as in
``run_control.py`` but using ``idiomaticity.embedders`` so MLX/causal/sentence models all work.

Primary output: per-model synonym--random gaps per group at the contextual-span level, plus the
ordinary-calibrated gap (OCG) = idiomatic gap / ordinary-control gap. OCG<1 means the model
separates idiomatic synonym from random *worse* than it does for ordinary (non-idiomatic) targets.
"""

from __future__ import annotations

import csv
import os
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from idiomaticity.data import locate_phrase  # noqa: E402
from idiomaticity.embedders.base import build_embedder  # noqa: E402
from idiomaticity.metrics import cosine_sim  # noqa: E402

HERE = Path(__file__).resolve().parent
EXAMPLES = HERE / "control_examples.csv"
OUT = HERE / "all_models"
VARIANT_COLUMNS = ("synonym", "component", "word_by_word", "related", "random")
GROUPS = ["idiomatic_nc", "compositional_nc", "ordinary_two_word_control", "single_word_control"]

# The 20 models used in the study (all cached; run offline).
MODELS = [
    # encoder / 2024 embedding cohort
    ("mBERT", {"type": "transformer", "hf_id": "bert-base-multilingual-cased", "last_n_layers": 4}),
    ("DistilBERT-ML", {"type": "transformer", "hf_id": "distilbert-base-multilingual-cased", "last_n_layers": 4}),
    ("mSBERT", {"type": "sentence", "hf_id": "sentence-transformers/distiluse-base-multilingual-cased"}),
    ("XLM-R-large", {"type": "transformer", "hf_id": "xlm-roberta-large", "last_n_layers": 4}),
    ("BGE-M3", {"type": "sentence", "hf_id": "BAAI/bge-m3"}),
    ("E5-large", {"type": "sentence", "hf_id": "intfloat/multilingual-e5-large"}),
    # modern embedding
    ("Qwen3-Emb-0.6B", {"type": "sentence", "hf_id": "Qwen/Qwen3-Embedding-0.6B"}),
    ("Qwen3-Emb-4B", {"type": "sentence", "hf_id": "Qwen/Qwen3-Embedding-4B", "dtype": "float16"}),
    ("mE5-large-instruct", {"type": "sentence", "hf_id": "intfloat/multilingual-e5-large-instruct"}),
    # decoder LLMs (torch)
    ("Qwen3-4B-Base", {"type": "causal", "hf_id": "Qwen/Qwen3-4B-Base", "last_n_layers": 4, "dtype": "float16"}),
    ("Gemma4-E2B-Base", {"type": "multimodal_causal", "hf_id": "google/gemma-4-E2B", "last_n_layers": 4, "dtype": "float16"}),
    # decoder LLMs (MLX)
    ("Qwen3.5-0.8B-Base", {"type": "mlx_causal", "hf_id": "Qwen/Qwen3.5-0.8B-Base"}),
    ("Qwen3.5-2B-it", {"type": "mlx_causal", "hf_id": "mlx-community/Qwen3.5-2B-MLX-bf16"}),
    ("Qwen3.5-4B-it", {"type": "mlx_causal", "hf_id": "mlx-community/Qwen3.5-4B-MLX-8bit"}),
    ("Qwen3.5-9B-it", {"type": "mlx_causal", "hf_id": "lmstudio-community/Qwen3.5-9B-MLX-4bit"}),
    ("Gemma3-1B-it", {"type": "mlx_causal", "hf_id": "mlx-community/gemma-3-1b-it-qat-4bit"}),
    ("Gemma3-4B-pt", {"type": "mlx_causal", "hf_id": "mlx-community/gemma-3-4b-pt-bf16"}),
    ("Gemma3-12B-pt", {"type": "mlx_causal", "hf_id": "mlx-community/gemma-3-12b-pt-6bit"}),
    ("Gemma4-12B-it", {"type": "mlx_causal", "hf_id": "mlx-community/gemma-4-12B-it-8bit"}),
    ("Gemma4-12B-base", {"type": "mlx_causal", "hf_id": "mlx-community/gemma-4-12B-mxfp8"}),
]


def load_examples():
    rows = []
    with open(EXAMPLES, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            variants = {c: r[c].strip() for c in VARIANT_COLUMNS if r.get(c, "").strip()}
            rows.append({"group": r["group"], "name": r["name"],
                         "original": r["original"], "target": r["target"], "variants": variants})
    return rows


def span_of(sentence, phrase):
    sp = locate_phrase(sentence, phrase)
    if sp is None:  # fall back to whole sentence
        return (0, len(sentence.split()))
    return sp


def run_model(name, cfg, examples):
    emb = build_embedder({"name": name, **cfg})
    rows = []
    for ex in examples:
        o_sent = emb.embed_sentence(ex["original"])
        o_span = emb.embed_span(ex["original"], span_of(ex["original"], ex["target"]))
        o_iso = emb.embed_sentence(ex["target"])
        for variant, repl in ex["variants"].items():
            changed = ex["original"].replace(ex["target"], repl, 1)
            rows.append({
                "model": name, "group": ex["group"], "case": ex["name"], "variant": variant,
                "sentence_sim": cosine_sim(o_sent, emb.embed_sentence(changed)),
                "contextual_span_sim": cosine_sim(o_span, emb.embed_span(changed, span_of(changed, repl))),
                "isolated_phrase_sim": cosine_sim(o_iso, emb.embed_sentence(repl)),
            })
    return rows


def summarize(rows, level="contextual_span_sim"):
    """Per-group synonym/random means + gap, and OCG vs ordinary baseline, for one model."""
    by = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by[r["group"]][r["variant"]].append(r[level])
    gaps, syn, rnd = {}, {}, {}
    for g in GROUPS:
        s = np.mean(by[g]["synonym"]) if by[g]["synonym"] else np.nan
        n = np.mean(by[g]["random"]) if by[g]["random"] else np.nan
        syn[g], rnd[g], gaps[g] = s, n, s - n
    ord_gap = np.nanmean([gaps["ordinary_two_word_control"], gaps["single_word_control"]])
    ocg = {g: (gaps[g] / ord_gap if ord_gap and not np.isnan(ord_gap) else np.nan) for g in GROUPS}
    return {"syn": syn, "rnd": rnd, "gap": gaps, "ord_gap": ord_gap, "ocg": ocg}


def main():
    examples = load_examples()
    OUT.mkdir(parents=True, exist_ok=True)
    combined = []
    summary_rows = []
    only = sys.argv[1:] or None
    for name, cfg in MODELS:
        if only and name not in only:
            continue
        print(f"=== {name} ===", flush=True)
        try:
            rows = run_model(name, cfg, examples)
        except Exception as exc:
            print(f"  SKIPPED: {type(exc).__name__}: {exc}", flush=True)
            continue
        # per-model raw
        md = OUT / name
        md.mkdir(parents=True, exist_ok=True)
        with open(md / "results.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader(); w.writerows(rows)
        combined.extend(rows)
        s = summarize(rows)
        summary_rows.append({
            "model": name,
            "idiom_gap": s["gap"]["idiomatic_nc"], "comp_gap": s["gap"]["compositional_nc"],
            "ordword_gap": s["gap"]["single_word_control"], "ordphrase_gap": s["gap"]["ordinary_two_word_control"],
            "ordinary_gap": s["ord_gap"],
            "OCG_idiom": s["ocg"]["idiomatic_nc"], "OCG_comp": s["ocg"]["compositional_nc"],
        })
        print(f"  idiom_gap={s['gap']['idiomatic_nc']:+.3f} ord_gap={s['ord_gap']:+.3f} "
              f"OCG_idiom={s['ocg']['idiomatic_nc']:+.3f}", flush=True)
    # write combined
    if combined:
        with open(OUT / "combined_results.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(combined[0].keys())); w.writeheader(); w.writerows(combined)
    if summary_rows:
        with open(OUT / "summary_table.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(summary_rows[0].keys())); w.writeheader(); w.writerows(summary_rows)
    print("DONE_CONTROL_ALL")


if __name__ == "__main__":
    main()
