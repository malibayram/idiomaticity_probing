#!/usr/bin/env python3
"""Build tables and figures for the perturbation-calibration article draft."""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd

os.environ.setdefault(
    "MPLCONFIGDIR", "/private/tmp/semeval2022-matplotlib-cache"
)
os.environ.setdefault("XDG_CACHE_HOME", "/private/tmp/semeval2022-xdg-cache")

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
ARTICLE = Path(__file__).resolve().parent
FIGURES = ARTICLE / "figures"
TABLES = ARTICLE / "tables"

OLD_MODELS = {"mBERT", "DistilBERT-ML", "mSBERT"}
NEW_MODELS = {"XLM-R-large", "BGE-M3", "E5-large"}
PERTURBATION_RUNS = {
    "BERT-large": ROOT / "experiments/perturbation_control/bert-large-uncased/results.csv",
    "EmbeddingMagibu-200M": ROOT / "experiments/perturbation_control/results.csv",
}
# Decoder-only LLM runs (base/PT, contextual span). Only those with an indicators.csv on disk
# are included, so the table grows automatically as more runs finish (8B, 14B, Gemma 4, ...).
# (display name, generation, type, run path). MLX rows use the last-4-layers + final-norm recipe.
DECODER_LLM_RUNS = {
    "Qwen3-4B-Base": ("2025", "base/torch", ROOT / "runs/qwen4_en/indicators.csv"),
    "Qwen3.5-0.8B-Base": ("2026", "base/mlx", ROOT / "runs/small_Qwen3.5-0.8B-Base/indicators.csv"),
    "Qwen3.5-2B-it": ("2026", "instruct/mlx", ROOT / "runs/llm_Qwen3.5-2B-it/indicators.csv"),
    "Qwen3.5-4B-it": ("2026", "instruct/mlx", ROOT / "runs/llm_Qwen3.5-4B-it/indicators.csv"),
    "Qwen3.5-9B-it": ("2026", "instruct/mlx", ROOT / "runs/llm_Qwen3.5-9B-it/indicators.csv"),
    "Gemma3-1B-it": ("2025", "instruct/mlx", ROOT / "runs/llm_Gemma3-1B-it/indicators.csv"),
    "Gemma3-4B-pt": ("2025", "base/mlx", ROOT / "runs/llm_Gemma3-4B-pt/indicators.csv"),
    "Gemma3-12B-pt": ("2025", "base/mlx", ROOT / "runs/llm_Gemma3-12B-pt/indicators.csv"),
    "Gemma4-E2B-Base": ("2026", "base/torch", ROOT / "runs/small_Gemma4-E2B-Base/indicators.csv"),
    "Gemma4-12B-base": ("2026", "base/mlx", ROOT / "runs/llm_Gemma4-12B-base/indicators.csv"),
    "Gemma4-12B-it": ("2026", "instruct/mlx", ROOT / "runs/llm_Gemma4-12B-it/indicators.csv"),
}
# Modern sentence-embedding models (2025-2026). At NC level these are ISOLATED-PHRASE
# embeddings, not contextual token spans (see article methodology note).
MODERN_EMB_RUNS = {
    "Qwen3-Emb-0.6B": ROOT / "runs/emb_Qwen3-Emb-0.6B/indicators.csv",
    "Qwen3-Emb-4B": ROOT / "runs/emb_Qwen3-Emb-4B/indicators.csv",
    "mE5-large-instruct": ROOT / "runs/emb_mE5-large-instruct/indicators.csv",
    "Qwen3-Emb-8B": ROOT / "runs/emb_Qwen3-Emb-8B/indicators.csv",
    "Harrier-OSS-0.6B": ROOT / "runs/emb_Harrier-OSS-0.6B/indicators.csv",
    "llama-embed-nemotron-8b": ROOT / "runs/emb_llama-embed-nemotron-8b/indicators.csv",
}
LEVELS = ["sentence_sim", "contextual_span_sim", "isolated_phrase_sim"]
GROUP_ORDER = [
    "idiomatic_nc",
    "compositional_nc",
    "ordinary_two_word_control",
    "single_word_control",
]


def ensure_dirs() -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    TABLES.mkdir(parents=True, exist_ok=True)


def load_indicators() -> pd.DataFrame:
    frames = []
    for path in [ROOT / "runs/en_all/indicators.csv", ROOT / "runs/pt_all/indicators.csv"]:
        frame = pd.read_csv(path)
        frame["cohort"] = frame["model"].map(
            lambda model: "paper-era" if model in OLD_MODELS else "modern"
        )
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def build_model_tables(indicators: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    metrics = ["ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS"]
    by_model = (
        indicators.groupby(["lang", "model", "cohort"], as_index=False)[metrics]
        .mean()
        .sort_values(["lang", "cohort", "model"])
    )
    by_model.to_csv(TABLES / "model_diagnostics.csv", index=False)

    by_cohort = (
        indicators.groupby(["lang", "cohort"], as_index=False)[metrics]
        .mean()
        .sort_values(["lang", "cohort"])
    )
    by_cohort.to_csv(TABLES / "cohort_diagnostics.csv", index=False)
    return by_model, by_cohort


def build_llm_table() -> pd.DataFrame:
    """Aggregate completed decoder-only LLM runs (averaged over contexts) into one table and
    emit a ready-to-\\input LaTeX table body so the article numbers update automatically."""
    metrics = ["ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS"]
    rows = []
    for name, (gen, typ, path) in DECODER_LLM_RUNS.items():
        if not path.exists():
            continue
        frame = pd.read_csv(path)
        vals = frame[metrics].mean()
        rows.append({"model": name, "gen": gen, "type": typ, **{m: float(vals[m]) for m in metrics}})
    if not rows:
        print("  [llm] no completed decoder-only LLM runs found yet.")
        return pd.DataFrame()
    df = pd.DataFrame(rows).sort_values("ICS")
    df.to_csv(TABLES / "llm_diagnostics.csv", index=False)

    # Emit the COMPLETE LaTeX tabular (\input'ed by main.tex *outside* any tabular, which avoids
    # the "Misplaced \noalign" you get from \input'ing only a body next to \bottomrule).
    body = []
    for _, r in df.iterrows():
        model_tex = r["model"].replace("_", "\\_")
        body.append(
            f"{model_tex} & {r['gen']} & {r['type']} & "
            f"{r['ISC']:+.3f} & {r['LOD']:+.3f} & {r['FLOOR']:.3f} & {r['ICS']:.3f} \\\\"
        )
    tabular = (
        "\\begin{tabular}{lllrrrr}\n\\toprule\n"
        "Model & Gen. & Type & ISC & LOD & FLOOR & ICS \\\\\n\\midrule\n"
        + "\n".join(body)
        + "\n\\bottomrule\n\\end{tabular}"
    )
    (TABLES / "llm_diagnostics.tex").write_text(tabular)
    print(f"  [llm] included {len(df)}: {sorted(df['model'])}")
    return df


def build_modern_emb_table() -> pd.DataFrame:
    """Aggregate completed modern (2025-2026) sentence-embedding runs into one table."""
    metrics = ["ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS"]
    rows = []
    for model, path in MODERN_EMB_RUNS.items():
        if not path.exists():
            continue
        frame = pd.read_csv(path)
        agg = frame.groupby(["lang", "model"], as_index=False)[metrics].mean()
        rows.append(agg)
    if not rows:
        print("  [emb] no completed modern-embedding runs found yet.")
        return pd.DataFrame()
    df = pd.concat(rows, ignore_index=True).sort_values(["lang", "ICS"])
    df.to_csv(TABLES / "modern_embedding_diagnostics.csv", index=False)
    print(f"  [emb] included: {sorted(df['model'].unique())}")
    return df


def build_perturbation_tables() -> tuple[pd.DataFrame, pd.DataFrame]:
    all_means = []
    all_calibrated = []

    for model, path in PERTURBATION_RUNS.items():
        frame = pd.read_csv(path)
        means = (
            frame.groupby(["group", "variant"], as_index=False)[LEVELS]
            .mean()
            .assign(model=model)
        )
        all_means.append(means[["model", "group", "variant", *LEVELS]])

        syn = means[means["variant"] == "synonym"].set_index("group")
        rnd = means[means["variant"] == "random"].set_index("group")

        for level in LEVELS:
            gaps = syn[level] - rnd[level]
            ordinary_gap = float(
                gaps.loc[["ordinary_two_word_control", "single_word_control"]].mean()
            )
            ordinary_syn = float(
                syn.loc[["ordinary_two_word_control", "single_word_control"], level].mean()
            )
            ordinary_random = float(
                rnd.loc[["ordinary_two_word_control", "single_word_control"], level].mean()
            )
            for group in GROUP_ORDER:
                gap = float(gaps.loc[group])
                calibrated_gap = gap / ordinary_gap if abs(ordinary_gap) > 1e-12 else np.nan
                aligned_syn = (
                    (float(syn.loc[group, level]) - ordinary_random) / ordinary_gap
                    if abs(ordinary_gap) > 1e-12
                    else np.nan
                )
                aligned_random = (
                    (float(rnd.loc[group, level]) - ordinary_random) / ordinary_gap
                    if abs(ordinary_gap) > 1e-12
                    else np.nan
                )
                all_calibrated.append(
                    {
                        "model": model,
                        "level": level,
                        "group": group,
                        "synonym": float(syn.loc[group, level]),
                        "random": float(rnd.loc[group, level]),
                        "gap": gap,
                        "ordinary_gap": ordinary_gap,
                        "ordinary_calibrated_gap": calibrated_gap,
                        "ordinary_aligned_synonym": aligned_syn,
                        "ordinary_aligned_random": aligned_random,
                    }
                )

    means_df = pd.concat(all_means, ignore_index=True)
    calibrated_df = pd.DataFrame(all_calibrated)
    means_df.to_csv(TABLES / "perturbation_group_means.csv", index=False)
    calibrated_df.to_csv(TABLES / "ordinary_calibrated_gaps.csv", index=False)
    return means_df, calibrated_df


def plot_ics(by_model: pd.DataFrame) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.2), sharey=True)
    colors = {"paper-era": "#4C78A8", "modern": "#F58518"}
    for ax, lang in zip(axes, ["EN", "PT"]):
        subset = by_model[by_model["lang"] == lang].copy()
        subset["order"] = subset["cohort"].map({"paper-era": 0, "modern": 1})
        subset = subset.sort_values(["order", "ICS"])
        positions = np.arange(len(subset))
        ax.bar(
            positions,
            subset["ICS"],
            color=[colors[c] for c in subset["cohort"]],
            edgecolor="black",
            linewidth=0.5,
        )
        ax.axhline(0.55, color="#666666", linestyle="--", linewidth=1, label="partial threshold")
        ax.set_title(lang)
        ax.set_xticks(positions)
        ax.set_xticklabels(subset["model"], rotation=35, ha="right")
        ax.set_ylim(0, 0.62)
        ax.set_ylabel("ICS")
        ax.grid(axis="y", alpha=0.25)
    handles = [
        plt.Rectangle((0, 0), 1, 1, color=colors["paper-era"]),
        plt.Rectangle((0, 0), 1, 1, color=colors["modern"]),
    ]
    fig.legend(handles, ["paper-era", "modern"], loc="upper center", ncol=2, frameon=False)
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    fig.savefig(FIGURES / "ics_by_model_language.png", dpi=200)
    plt.close(fig)


def plot_diagnostics(by_model: pd.DataFrame) -> None:
    metrics = ["ICS", "LOD", "AID", "FLOOR"]
    labels = []
    rows = []
    for lang in ["EN", "PT"]:
        subset = by_model[by_model["lang"] == lang].sort_values(["cohort", "model"])
        for _, row in subset.iterrows():
            labels.append(f"{lang} {row['model']}")
            rows.append([row[m] for m in metrics])
    matrix = np.array(rows)

    fig, ax = plt.subplots(figsize=(7.2, 6.4))
    image = ax.imshow(matrix, aspect="auto", cmap="coolwarm", vmin=-0.25, vmax=1.0)
    ax.set_xticks(np.arange(len(metrics)))
    ax.set_xticklabels(metrics)
    ax.set_yticks(np.arange(len(labels)))
    ax.set_yticklabels(labels, fontsize=8)
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ax.text(j, i, f"{matrix[i, j]:.2f}", ha="center", va="center", fontsize=7)
    ax.set_title("Model diagnostics: capture, lexical bias, affinity, floor")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(FIGURES / "model_diagnostic_heatmap.png", dpi=200)
    plt.close(fig)


def plot_calibrated_gaps(calibrated: pd.DataFrame) -> None:
    subset = calibrated[calibrated["level"] == "contextual_span_sim"].copy()
    group_labels = {
        "idiomatic_nc": "Idiomatic NC",
        "compositional_nc": "Compositional NC",
        "ordinary_two_word_control": "Ordinary phrase",
        "single_word_control": "Ordinary word",
    }

    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.0), sharey=True)
    for ax, model in zip(axes, ["BERT-large", "EmbeddingMagibu-200M"]):
        data = subset[subset["model"] == model].set_index("group").loc[GROUP_ORDER]
        positions = np.arange(len(data))
        ax.bar(
            positions,
            data["ordinary_calibrated_gap"],
            color=["#E45756", "#72B7B2", "#54A24B", "#54A24B"],
            edgecolor="black",
            linewidth=0.5,
        )
        ax.axhline(1.0, color="#333333", linestyle="--", linewidth=1)
        ax.axhline(0.0, color="#888888", linewidth=0.8)
        ax.set_title(model)
        ax.set_xticks(positions)
        ax.set_xticklabels([group_labels[g] for g in data.index], rotation=25, ha="right")
        ax.set_ylabel("Ordinary-calibrated gap")
        ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(FIGURES / "ordinary_calibrated_contextual_gap.png", dpi=200)
    plt.close(fig)


def plot_random_sentence_floor(means: pd.DataFrame) -> None:
    rnd = means[means["variant"] == "random"].copy()
    group_labels = {
        "idiomatic_nc": "Idiomatic NC",
        "compositional_nc": "Compositional NC",
        "ordinary_two_word_control": "Ordinary phrase",
        "single_word_control": "Ordinary word",
    }
    fig, ax = plt.subplots(figsize=(8.0, 4.2))
    width = 0.35
    positions = np.arange(len(GROUP_ORDER))
    for offset, model in [(-width / 2, "BERT-large"), (width / 2, "EmbeddingMagibu-200M")]:
        data = rnd[rnd["model"] == model].set_index("group").loc[GROUP_ORDER]
        ax.bar(
            positions + offset,
            data["sentence_sim"],
            width=width,
            label=model,
            edgecolor="black",
            linewidth=0.5,
        )
    ax.set_xticks(positions)
    ax.set_xticklabels([group_labels[g] for g in GROUP_ORDER], rotation=20, ha="right")
    ax.set_ylabel("Random full-sentence similarity")
    ax.set_ylim(0.85, 1.01)
    ax.grid(axis="y", alpha=0.25)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIGURES / "random_sentence_floor.png", dpi=200)
    plt.close(fig)


def plot_ocg_all_models() -> None:
    """Bar chart of the ordinary-calibrated idiomatic gap (OCG) across all 20 models."""
    import matplotlib.pyplot as plt

    src = ROOT / "experiments/perturbation_control/all_models/summary_table.csv"
    if not src.exists():
        print("  [ocg] summary_table.csv yok, atlanıyor.")
        return
    df = pd.read_csv(src)
    df = df[df.model != "Gemma4-12B-it"]  # collapsed space -> OCG unstable, exclude from the chart
    df = df.sort_values("OCG_idiom")
    fig, ax = plt.subplots(figsize=(9, 6))
    y = np.arange(len(df))
    ax.barh(y, df["OCG_idiom"], color="#E45756", label="idiomatic NC")
    ax.barh(y, df["OCG_comp"], left=0, height=0.0)  # keep scale
    ax.axvline(1.0, color="#333333", linestyle="--", linewidth=1, label="ordinary baseline (=1)")
    ax.axvline(0.0, color="#888888", linewidth=0.8)
    ax.set_yticks(y)
    ax.set_yticklabels(df["model"], fontsize=8)
    ax.set_xlabel("Ordinary-calibrated gap (OCG): idiomatic synonym--random separation\n"
                  "relative to ordinary controls (1 = as good as ordinary)")
    ax.set_title("No model separates idiomatic synonym from random as well as it does for "
                 "ordinary words/phrases")
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    p = FIGURES / "ocg_all_models.png"
    fig.savefig(p, dpi=150)
    plt.close(fig)
    print(f"  [ocg] wrote {p}")


def main() -> None:
    ensure_dirs()
    indicators = load_indicators()
    by_model, _by_cohort = build_model_tables(indicators)
    build_llm_table()
    build_modern_emb_table()
    plot_ocg_all_models()
    means, calibrated = build_perturbation_tables()
    plot_ics(by_model)
    plot_diagnostics(by_model)
    plot_calibrated_gaps(calibrated)
    plot_random_sentence_floor(means)


if __name__ == "__main__":
    main()
