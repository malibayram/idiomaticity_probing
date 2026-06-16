#!/usr/bin/env python3
"""Reproduce the paper's figures from a results.csv.

Generates:
  * similarity_<level>.png   — Figure 1/2 style: per-probe Sim distributions by model
  * scaled_<level>.png       — Figure 5 style: Sim_R|Syn vs Sim_R|WordsSyn by model
  * scaled_by_class_<level>  — Figure 6 style: Sim_R|Syn by idiomaticity class (I/PC/C)
  * correlogram_<level>.png  — Figure 10 style: between-model correlation of a measurement

Usage:
  python scripts/make_plots.py --results runs/compare/results.csv --out runs/compare/figures
"""

from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd


def _load(results_csv: str) -> pd.DataFrame:
    df = pd.read_csv(results_csv)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    return df


def plot_similarity(df: pd.DataFrame, level: str, out_dir: str) -> None:
    import matplotlib.pyplot as plt

    sub = df[(df.level == level) & df.measurement.str.startswith("sim_P_")]
    if sub.empty:
        return
    probes = ["sim_P_Syn", "sim_P_Comp", "sim_P_WordsSyn", "sim_P_Rand"]
    models = sorted(sub.model.unique())
    fig, axes = plt.subplots(2, 2, figsize=(12, 8), sharey=True)
    for ax, probe in zip(axes.ravel(), probes):
        data = [sub[(sub.model == m) & (sub.measurement == probe)].value.dropna()
                for m in models]
        ax.boxplot(data, tick_labels=models, showfliers=False)
        ax.set_title(probe.replace("sim_", ""))
        ax.set_ylim(-0.2, 1.05)
        ax.axhspan(*_ideal_band(probe), color="tab:green", alpha=0.08)
        ax.tick_params(axis="x", rotation=45)
        ax.set_ylabel("cosine similarity")
    fig.suptitle(f"Per-probe similarity distributions ({level} level)")
    fig.tight_layout()
    path = os.path.join(out_dir, f"similarity_{level}.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print(f"  wrote {path}")


def _ideal_band(probe: str):
    return {
        "sim_P_Syn": (0.9, 1.0),
        "sim_P_Comp": (0.4, 0.6),
        "sim_P_WordsSyn": (0.4, 0.6),
        "sim_P_Rand": (0.0, 0.2),
    }.get(probe, (0, 1))


def plot_scaled(df: pd.DataFrame, level: str, out_dir: str) -> None:
    import matplotlib.pyplot as plt

    sub = df[(df.level == level) & df.measurement.isin(["simR_Syn", "simR_WordsSyn"])]
    if sub.empty:
        return
    models = sorted(sub.model.unique())
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), sharey=True)
    for ax, meas, title in zip(
        axes, ["simR_Syn", "simR_WordsSyn"], ["Sim_R | Syn", "Sim_R | WordsSyn"]
    ):
        data = [sub[(sub.model == m) & (sub.measurement == meas)].value.dropna()
                for m in models]
        ax.boxplot(data, tick_labels=models, showfliers=False)
        ax.axhline(0, color="k", ls="--", lw=0.8)
        ax.axhline(1, color="tab:green", ls=":", lw=0.8)
        ax.set_title(title)
        ax.tick_params(axis="x", rotation=45)
    axes[0].set_ylabel("Scaled Similarity")
    fig.suptitle(f"Scaled Similarity ({level} level): Syn should ~1, WordsSyn ~0 for idiomatic")
    fig.tight_layout()
    path = os.path.join(out_dir, f"scaled_{level}.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print(f"  wrote {path}")


def plot_scaled_by_class(df: pd.DataFrame, level: str, out_dir: str) -> None:
    import matplotlib.pyplot as plt

    sub = df[(df.level == level) & (df.measurement == "simR_Syn")]
    sub = sub[sub.comp_class.isin(["I", "PC", "C"])]
    if sub.empty:
        return
    models = sorted(sub.model.unique())
    colors = {"I": "tab:green", "PC": "tab:orange", "C": "tab:blue"}
    fig, ax = plt.subplots(figsize=(max(8, len(models) * 1.5), 5))
    width = 0.25
    x = np.arange(len(models))
    for k, cls in enumerate(["I", "PC", "C"]):
        means = [sub[(sub.model == m) & (sub.comp_class == cls)].value.mean()
                 for m in models]
        ax.bar(x + (k - 1) * width, means, width, label=cls, color=colors[cls])
    ax.set_xticks(x)
    ax.set_xticklabels(models, rotation=45, ha="right")
    ax.axhline(0, color="k", lw=0.8)
    ax.set_ylabel("mean Sim_R | Syn")
    ax.set_title(f"Sim_R|Syn by idiomaticity class ({level} level)")
    ax.legend(title="class")
    fig.tight_layout()
    path = os.path.join(out_dir, f"scaled_by_class_{level}.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print(f"  wrote {path}")


def plot_correlogram(df: pd.DataFrame, level: str, out_dir: str,
                     measurement: str = "sim_P_Syn") -> None:
    import matplotlib.pyplot as plt

    sub = df[(df.level == level) & (df.measurement == measurement)]
    models = sorted(sub.model.unique())
    if len(models) < 2:
        return
    # Align by (nc, context, sent_id) so vectors are comparable across models.
    pivot = sub.pivot_table(
        index=["nc", "context", "sent_id"], columns="model", values="value"
    )
    corr = pivot.corr(method="spearman")
    fig, ax = plt.subplots(figsize=(1.2 * len(models) + 2, 1.2 * len(models) + 1))
    im = ax.imshow(corr.values, vmin=-1, vmax=1, cmap="RdBu_r")
    ax.set_xticks(range(len(models)))
    ax.set_yticks(range(len(models)))
    ax.set_xticklabels(models, rotation=45, ha="right")
    ax.set_yticklabels(models)
    for i in range(len(models)):
        for j in range(len(models)):
            val = corr.values[i, j]
            if val == val:
                ax.text(j, i, f"{val:.2f}", ha="center", va="center", fontsize=8)
    fig.colorbar(im, ax=ax, fraction=0.046)
    ax.set_title(f"Between-model Spearman ρ of {measurement} ({level})")
    fig.tight_layout()
    path = os.path.join(out_dir, f"correlogram_{level}.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print(f"  wrote {path}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", required=True, help="Path to results.csv")
    ap.add_argument("--out", default="figures", help="Output directory for PNGs")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    df = _load(args.results)
    for level in df.level.unique():
        print(f"level={level}:")
        plot_similarity(df, level, args.out)
        plot_scaled(df, level, args.out)
        plot_scaled_by_class(df, level, args.out)
        plot_correlogram(df, level, args.out)


if __name__ == "__main__":
    main()
