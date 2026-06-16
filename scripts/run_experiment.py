#!/usr/bin/env python3
"""CLI: run the idiomaticity probes + metrics for one or more models.

Examples
--------
  # Smoke test with the dependency-free mock model on the bundled sample data:
  python scripts/run_experiment.py --models mock --data data/sample \
      --lang EN --context naturalistic --level nc --out runs/smoke

  # Compare several models from models.yaml on real data:
  python scripts/run_experiment.py --models models.yaml --select mBERT XLM-R-large \
      --data data/ncimp --lang EN --context naturalistic neutral --level nc sentence \
      --out runs/compare
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys

# Make the package importable when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from idiomaticity.data import load_dataset  # noqa: E402
from idiomaticity.embedders.base import build_embedder  # noqa: E402
from idiomaticity.experiment import run, summarize_run  # noqa: E402


def parse_models(spec: list[str], select: list[str] | None) -> list[dict]:
    """Build model configs from a list of names and/or a YAML file path."""
    configs: list[dict] = []
    for item in spec:
        if item.endswith((".yaml", ".yml")) and os.path.isfile(item):
            import yaml

            with open(item, "r", encoding="utf-8") as fh:
                data = yaml.safe_load(fh)
            configs.extend(data.get("models", []))
        elif item == "mock":
            configs.append({"name": "mock", "type": "mock"})
        else:
            # Treat a bare string as a HF id -> transformer encoder.
            configs.append({"name": item, "type": "transformer", "hf_id": item})
    if select:
        wanted = set(select)
        configs = [c for c in configs if c.get("name") in wanted]
        if not configs:
            raise SystemExit(f"--select {select} matched no models in {spec}")
    return configs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--models", nargs="+", required=True,
                    help="Model names, HF ids, and/or a models.yaml path.")
    ap.add_argument("--select", nargs="*", default=None,
                    help="When --models is a yaml, restrict to these model names.")
    ap.add_argument("--data", default="data/sample", help="Dataset directory.")
    ap.add_argument("--lang", default="EN", help="Language code (EN, PT, TR, ...).")
    ap.add_argument("--context", nargs="+", default=["naturalistic"],
                    choices=["naturalistic", "neutral"])
    ap.add_argument("--level", nargs="+", default=["nc"], choices=["nc", "sentence"])
    ap.add_argument("--out", default="runs/run", help="Output directory.")
    ap.add_argument("--device", default=None, help="torch device (cuda/cpu/mps).")
    ap.add_argument("--limit", type=int, default=None, help="Cap number of instances (debug).")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    import random

    random.seed(args.seed)

    os.makedirs(args.out, exist_ok=True)
    items = load_dataset(args.data, lang=args.lang, contexts=tuple(args.context))
    items = [it for it in items if it.context in args.context]
    if args.limit:
        items = items[: args.limit]
    if not items:
        raise SystemExit(f"No instances loaded from {args.data} (lang={args.lang}).")
    print(f"Loaded {len(items)} instances ({args.lang}, contexts={args.context}).")

    model_configs = parse_models(args.models, args.select)
    if not model_configs:
        raise SystemExit("No models resolved.")

    all_rows: list[dict] = []
    for cfg in model_configs:
        if args.device and cfg.get("type") in ("transformer", "causal", "sentence"):
            cfg = {**cfg, "device": args.device}
        print(f"\n=== {cfg.get('name')} ({cfg.get('type')}) ===")
        try:
            embedder = build_embedder(cfg)
        except Exception as exc:  # missing dependency / model not found
            print(f"  SKIPPED: {exc}")
            continue
        for level in args.level:
            print(f"  level={level} ...")
            all_rows.extend(run(items, embedder, level=level, progress=True))

    if not all_rows:
        raise SystemExit("No results produced (all models skipped?).")

    # Write long-format results.
    results_path = os.path.join(args.out, "results.csv")
    fieldnames = list(all_rows[0].keys())
    with open(results_path, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    # Write summary.
    summary = summarize_run(all_rows)
    summary_path = os.path.join(args.out, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(all_rows)} rows -> {results_path}")
    print(f"Wrote summary -> {summary_path}")
    _print_summary(summary)


def _print_summary(summary: dict) -> None:
    print("\n=== Summary (mean ± std | ρ vs Comp) ===")
    for g in summary["groups"]:
        print(f"\n{g['model']} | {g['lang']} | {g['context']} | {g['level']}")
        for m, s in g["measurements"].items():
            if s["n"] == 0:
                continue
            rho = s.get("spearman_comp")
            rho_str = f" | ρ={rho:+.2f}" if rho == rho else ""  # NaN check
            print(f"  {m:18s} {s['mean']:+.3f} ± {s['std']:.3f}{rho_str}")


if __name__ == "__main__":
    main()
