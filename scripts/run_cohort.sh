#!/usr/bin/env bash
# Full lightweight EN+PT cohort run: experiment -> analysis -> plots, for both languages.
# Old cohort (paper-era): mBERT DistilBERT-ML mSBERT
# New cohort (modern):    XLM-R-large BGE-M3 E5-large
set -u
cd "$(dirname "$0")/.."

MODELS="mBERT DistilBERT-ML mSBERT XLM-R-large BGE-M3 E5-large"
OLD="mBERT DistilBERT-ML mSBERT"
NEW="XLM-R-large BGE-M3 E5-large"
DEVICE="${DEVICE:-mps}"

for LANG in EN PT; do
  OUT="runs/$(echo "$LANG" | tr '[:upper:]' '[:lower:]')_all"
  echo "=================================================================="
  echo " [$LANG] experiment -> $OUT  (device=$DEVICE)"
  echo "=================================================================="
  python3 scripts/run_experiment.py \
    --models models.yaml --select $MODELS \
    --data data/ncimp --lang "$LANG" --context naturalistic neutral --level nc \
    --device "$DEVICE" --out "$OUT" || echo "[$LANG] experiment FAILED"

  echo " [$LANG] analysis -> $OUT/REPORT.md"
  python3 scripts/analyze.py --results "$OUT/results.csv" --out "$OUT" --level nc \
    --old $OLD --new $NEW || echo "[$LANG] analysis FAILED"

  echo " [$LANG] plots -> $OUT/figures"
  python3 scripts/make_plots.py --results "$OUT/results.csv" --out "$OUT/figures" \
    2>/dev/null || echo "[$LANG] plots FAILED"
done

echo "=================================================================="
echo " DONE. See runs/en_all/REPORT.md and runs/pt_all/REPORT.md"
echo "=================================================================="
