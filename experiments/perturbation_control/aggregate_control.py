#!/usr/bin/env python3
"""Aggregate per-model perturbation-control results into one summary table.

Reads all_models/<model>/results.csv (written by run_control_all.py) and computes, at the
contextual-span level, per-group synonym--random gaps plus the ordinary-calibrated gap (OCG).
Robust to partial runs (uses whatever model folders exist).
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "all_models"
GROUPS = ["idiomatic_nc", "compositional_nc", "ordinary_two_word_control", "single_word_control"]
LEVEL = "contextual_span_sim"

# Presentation order (study order); only those with results are shown.
ORDER = [
    "mBERT", "DistilBERT-ML", "mSBERT", "XLM-R-large", "BGE-M3", "E5-large",
    "Qwen3-Emb-0.6B", "Qwen3-Emb-4B", "mE5-large-instruct",
    "Qwen3-4B-Base", "Qwen3.5-0.8B-Base", "Qwen3.5-2B-it", "Qwen3.5-4B-it", "Qwen3.5-9B-it",
    "Gemma3-1B-it", "Gemma3-4B-pt", "Gemma3-12B-pt",
    "Gemma4-E2B-Base", "Gemma4-12B-it", "Gemma4-12B-base",
]


def summarize(rows):
    by = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by[r["group"]][r["variant"]].append(float(r[LEVEL]))
    gap, syn, rnd = {}, {}, {}
    for g in GROUPS:
        s = np.mean(by[g]["synonym"]) if by[g]["synonym"] else np.nan
        n = np.mean(by[g]["random"]) if by[g]["random"] else np.nan
        syn[g], rnd[g], gap[g] = s, n, s - n
    ord_gap = np.nanmean([gap["ordinary_two_word_control"], gap["single_word_control"]])
    ocg = {g: (gap[g] / ord_gap if ord_gap else np.nan) for g in GROUPS}
    return syn, rnd, gap, ord_gap, ocg


def main():
    out_rows = []
    for name in ORDER:
        p = OUT / name / "results.csv"
        if not p.exists():
            continue
        rows = list(csv.DictReader(open(p, encoding="utf-8")))
        syn, rnd, gap, ord_gap, ocg = summarize(rows)
        out_rows.append({
            "model": name,
            "idiom_syn": syn["idiomatic_nc"], "idiom_rnd": rnd["idiomatic_nc"],
            "idiom_gap": gap["idiomatic_nc"], "comp_gap": gap["compositional_nc"],
            "ordword_gap": gap["single_word_control"], "ordphrase_gap": gap["ordinary_two_word_control"],
            "ordinary_gap": ord_gap,
            "OCG_idiom": ocg["idiomatic_nc"], "OCG_comp": ocg["compositional_nc"],
        })
    with open(OUT / "summary_table.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out_rows[0].keys()))
        w.writeheader(); w.writerows(out_rows)
    # pretty print
    print(f"{'model':18s} {'idiom_gap':>9s} {'comp_gap':>9s} {'ord_gap':>9s} {'OCG_idiom':>9s} {'OCG_comp':>9s}")
    for r in out_rows:
        print(f"{r['model']:18s} {r['idiom_gap']:+9.3f} {r['comp_gap']:+9.3f} "
              f"{r['ordinary_gap']:+9.3f} {r['OCG_idiom']:+9.3f} {r['OCG_comp']:+9.3f}")
    print(f"\n{len(out_rows)} model. Tablo -> {OUT/'summary_table.csv'}")


if __name__ == "__main__":
    main()
