#!/usr/bin/env python3
"""Answer the central research question from a results.csv.

Produces:
  * a per-model indicators table (ISC, IG, LOD, AID, FLOOR, RHO, ICS) + verdict,
  * an old-vs-new cohort comparison with direction-aware "improved?" flags,
  * a markdown report (REPORT.md) summarizing "did modern models improve, by how much, and if
    not, what is the fundamental problem".

Usage:
  python scripts/analyze.py --results runs/compare/results.csv --out runs/compare \
      --old mBERT DistilBERT-ML mSBERT ELMo Word2Vec GloVe Llama2 \
      --new XLM-R-large BGE-M3 E5-large BERTurk Qwen2.5-7B Llama-3.1-8B \
      --level nc
"""

from __future__ import annotations

import argparse
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from idiomaticity.analysis import (  # noqa: E402
    cohort_comparison,
    compute_indicators,
    diagnose,
    indicators_table,
    verdict,
)

_DIR_LABEL = {
    "ISC": "↑ ideal≈1", "IG": "↓ ideal≈0", "LOD": "↓ ideal<0",
    "AID": "↑ ideal>0", "FLOOR": "diag", "RHO": "↓ |ρ|≈0", "ICS": "↑ [0,1]",
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", required=True)
    ap.add_argument("--out", default=".")
    ap.add_argument("--level", default="nc", choices=["nc", "sentence"])
    ap.add_argument("--lang", nargs="*", default=None)
    ap.add_argument("--context", nargs="*", default=None)
    ap.add_argument("--old", nargs="*", default=[], help="Paper-era model names.")
    ap.add_argument("--new", nargs="*", default=[], help="Modern model names.")
    args = ap.parse_args()

    df = pd.read_csv(args.results)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    table = indicators_table(df, level=args.level, langs=args.lang, contexts=args.context)
    if table.empty:
        raise SystemExit("No indicators computed - check --level/--lang/--context and data.")

    os.makedirs(args.out, exist_ok=True)
    table_path = os.path.join(args.out, "indicators.csv")
    table.to_csv(table_path, index=False)

    lines: list[str] = []
    lines.append("# Idiomaticity - Did Modern Models Improve?\n")
    lines.append(f"Computed at **{args.level}** level from `{os.path.basename(args.results)}`.\n")
    lines.append(_indicator_legend())

    # Per-model table
    lines.append("\n## Per-model indicators\n")
    lines.append(_markdown_table(table))

    # Verdicts + diagnosis (collapsed across lang/context by mean)
    lines.append("\n## Verdict & diagnosis per model\n")
    for model in sorted(table.model.unique()):
        msub = table[table.model == model]
        ics = pd.to_numeric(msub.ICS, errors="coerce").mean()
        # Use the first available (lang, context) for a representative diagnosis.
        rep = None
        for lang in sorted(df.lang.unique()):
            for ctx in sorted(df.context.unique()):
                rep = compute_indicators(df, model, lang, ctx, args.level)
                if rep is not None:
                    break
            if rep is not None:
                break
        v = verdict(rep) if rep else "n/a"
        lines.append(f"### {model} - **{v}** (mean ICS={ics:.2f})")
        if rep:
            for note in diagnose(rep):
                lines.append(f"- {note}")
        lines.append("")

    # Cohort comparison
    if args.old and args.new:
        deltas = cohort_comparison(table, args.old, args.new)
        lines.append("\n## Old (paper-era) vs New (modern) cohort\n")
        lines.append(f"- **Old:** {', '.join(args.old)}")
        lines.append(f"- **New:** {', '.join(args.new)}\n")
        lines.append("| metric | old | new | Δ | improved? |")
        lines.append("|--------|-----|-----|---|-----------|")
        for m, d in deltas.items():
            imp = "-" if d["improved"] is None else ("✅" if d["improved"] else "❌")
            lines.append(
                f"| {m} ({_DIR_LABEL[m]}) | {d['old']:+.3f} | {d['new']:+.3f} "
                f"| {d['delta']:+.3f} | {imp} |"
            )
        ics_d = deltas["ICS"]
        verdict_line = _cohort_verdict(ics_d)
        lines.append(f"\n**Bottom line:** {verdict_line}")

    report_path = os.path.join(args.out, "REPORT.md")
    with open(report_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"Wrote {table_path}")
    print(f"Wrote {report_path}\n")
    print("\n".join(lines[-25:]))


def _cohort_verdict(ics_delta: dict) -> str:
    d = ics_delta["delta"]
    old, new = ics_delta["old"], ics_delta["new"]
    rel = (d / old * 100) if old else float("nan")
    if d > 0.10:
        return (f"Modern models improved meaningfully (ICS {old:.2f} → {new:.2f}, "
                f"{rel:+.0f}%). Idiomaticity capture is getting better.")
    if d > 0.03:
        return (f"Modest improvement (ICS {old:.2f} → {new:.2f}, {rel:+.0f}%) - progress, but "
                "idiomaticity is still far from solved.")
    if d > -0.03:
        return (f"Essentially no change (ICS {old:.2f} → {new:.2f}). Scaling/architecture gains "
                "elsewhere did NOT transfer to idiomaticity - consistent with a representational "
                "bias toward lexical composition rather than a capacity problem.")
    return (f"Modern models are no better (ICS {old:.2f} → {new:.2f}). The bottleneck is "
            "structural, not scale.")


def _indicator_legend() -> str:
    return (
        "\n**Indicators** (NC level): "
        "`ISC`=Idiomatic Synonymy Capture (↑), `IG`=Idiomaticity Gap C−I (↓), "
        "`LOD`=Lexical-Overlap Dominance (↓, <0 good), `AID`=Affinity on idioms (↑), "
        "`FLOOR`=random-sim floor / anisotropy proxy (diagnostic), "
        "`RHO`=ρ(Sim_R|Syn, Comp) (↓), `ICS`=composite capture score ∈[0,1] (↑).\n"
    )


def _markdown_table(table: pd.DataFrame) -> str:
    cols = ["model", "lang", "context", "n_idiomatic",
            "ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS"]
    cols = [c for c in cols if c in table.columns]
    header = "| " + " | ".join(cols) + " |"
    sep = "|" + "|".join("---" for _ in cols) + "|"
    rows = []
    for _, r in table.iterrows():
        cells = []
        for c in cols:
            v = r[c]
            cells.append(f"{v:+.3f}" if isinstance(v, float) else str(v))
        rows.append("| " + " | ".join(cells) + " |")
    return "\n".join([header, sep] + rows)


if __name__ == "__main__":
    main()
