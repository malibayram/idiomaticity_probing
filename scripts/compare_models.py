#!/usr/bin/env python3
"""Cross-model comparison figures for the central research question.

From a results.csv, builds report-friendly charts that put all models side by side and
highlight the old (paper-era) vs new (modern) cohort split:

  * ics_by_model.png        — composite Idiomaticity Capture Score per model (old vs new colored)
  * indicators_grid.png     — ISC / IG / LOD / AID per model (with ideal-direction arrows)
  * simR_by_class.png       — mean Sim_R|Syn per idiomaticity class (I/PC/C) per model

Usage:
  python scripts/compare_models.py --results runs/en_all/results.csv --out runs/en_all/figures \
      --old mBERT DistilBERT-ML mSBERT --new XLM-R-large BGE-M3 E5-large --context naturalistic
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from idiomaticity.analysis import indicators_table  # noqa: E402

OLD_COLOR = "#9e9e9e"
NEW_COLOR = "#1f77b4"


def _cohort_colors(models, old, new):
    return [NEW_COLOR if m in new else (OLD_COLOR if m in old else "#cccccc") for m in models]


def plot_ics(table: pd.DataFrame, out_dir: str, old, new) -> None:
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch

    agg = table.groupby("model", as_index=False)["ICS"].mean().sort_values("ICS")
    models = agg.model.tolist()
    colors = _cohort_colors(models, old, new)
    fig, ax = plt.subplots(figsize=(max(7, len(models) * 1.1), 5))
    ax.bar(models, agg.ICS, color=colors)
    ax.axhline(0.7, color="tab:green", ls="--", lw=1, label="captures threshold (0.70)")
    ax.axhline(0.55, color="tab:orange", ls=":", lw=1, label="partial threshold (0.55)")
    ax.set_ylabel("Idiomaticity Capture Score (ICS)")
    ax.set_ylim(0, 1)
    ax.set_title("Did models improve? Composite ICS per model (higher = better)")
    ax.tick_params(axis="x", rotation=45)
    legend = [Patch(color=OLD_COLOR, label="old (paper-era)"),
              Patch(color=NEW_COLOR, label="new (modern)")]
    ax.legend(handles=legend + ax.get_legend_handles_labels()[0], loc="upper left")
    fig.tight_layout()
    p = os.path.join(out_dir, "ics_by_model.png")
    fig.savefig(p, dpi=130)
    plt.close(fig)
    print(f"  wrote {p}")


def plot_indicators_grid(table: pd.DataFrame, out_dir: str, old, new) -> None:
    import matplotlib.pyplot as plt

    specs = [
        ("ISC", "Idiomatic Synonymy Capture (↑ ideal≈1)", None),
        ("IG", "Idiomaticity Gap (↓ ideal≈0)", 0.0),
        ("LOD", "Lexical-Overlap Dominance (↓ ideal<0)", 0.0),
        ("AID", "Affinity on idioms (↑ ideal>0)", 0.0),
    ]
    agg = table.groupby("model", as_index=False)[["ISC", "IG", "LOD", "AID"]].mean()
    agg = agg.sort_values("ISC")
    models = agg.model.tolist()
    colors = _cohort_colors(models, old, new)
    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    for ax, (col, title, ref) in zip(axes.ravel(), specs):
        ax.bar(models, agg[col], color=colors)
        if ref is not None:
            ax.axhline(ref, color="k", lw=0.8)
        ax.set_title(title)
        ax.tick_params(axis="x", rotation=45)
    fig.suptitle("Per-indicator comparison (grey=old, blue=new)")
    fig.tight_layout()
    p = os.path.join(out_dir, "indicators_grid.png")
    fig.savefig(p, dpi=130)
    plt.close(fig)
    print(f"  wrote {p}")


def plot_simR_by_class(df: pd.DataFrame, out_dir: str, level: str, context: str) -> None:
    import matplotlib.pyplot as plt

    sub = df[
        (df.level == level)
        & (df.measurement == "simR_Syn")
        & (df.comp_class.isin(["I", "PC", "C"]))
    ]
    if context:
        sub = sub[sub.context == context]
    if sub.empty:
        return
    models = sorted(sub.model.unique())
    colors = {"I": "tab:green", "PC": "tab:orange", "C": "tab:blue"}
    x = np.arange(len(models))
    width = 0.26
    fig, ax = plt.subplots(figsize=(max(8, len(models) * 1.3), 5))
    for k, cls in enumerate(["I", "PC", "C"]):
        means = [sub[(sub.model == m) & (sub.comp_class == cls)].value.mean() for m in models]
        ax.bar(x + (k - 1) * width, means, width, label=cls, color=colors[cls])
    ax.set_xticks(x)
    ax.set_xticklabels(models, rotation=45, ha="right")
    ax.axhline(0, color="k", lw=0.8)
    ax.set_ylabel("mean Sim_R | Syn")
    ax.set_title(
        "Gold-synonym recovery by idiomaticity class — ideal: all bars ≈1 and flat"
    )
    ax.legend(title="class")
    fig.tight_layout()
    p = os.path.join(out_dir, "simR_by_class.png")
    fig.savefig(p, dpi=130)
    plt.close(fig)
    print(f"  wrote {p}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", required=True)
    ap.add_argument("--out", default="figures")
    ap.add_argument("--level", default="nc", choices=["nc", "sentence"])
    ap.add_argument("--context", default="naturalistic",
                    help="Context to use for per-class chart (blank = all).")
    ap.add_argument("--old", nargs="*", default=[])
    ap.add_argument("--new", nargs="*", default=[])
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    df = pd.read_csv(args.results)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    table = indicators_table(df, level=args.level)
    if table.empty:
        raise SystemExit("No indicators computed.")

    plot_ics(table, args.out, args.old, args.new)
    plot_indicators_grid(table, args.out, args.old, args.new)
    plot_simR_by_class(df, args.out, args.level, args.context)


if __name__ == "__main__":
    main()
