# Article Draft: Perturbation Calibration

This folder contains the English LaTeX article draft for the ordinary-perturbation calibration
study.

## Files

- `main.tex` — manuscript source.
- `main.pdf` — compiled manuscript.
- `build_assets.py` — regenerates article tables and figures from saved repository results.
- `tables/` — generated CSV summaries used by the manuscript.
- `figures/` — generated figures used by the manuscript.

## Evidence Included

The draft uses the current worktree's completed outputs:

- `runs/en_all/` and `runs/pt_all/`: six-model EN/PT NCIMP cohort.
- `runs/en_mbert/`: mBERT reproduction pilot, also covered by `runs/en_all/`.
- `runs/smoke/` and `runs/real_mock/`: validation/provenance runs, not scientific model evidence.
- `experiments/perturbation_control/bert-large-uncased/`: BERT-large ordinary-control pilot.
- `experiments/perturbation_control/`: local `alibayram/embeddingmagibu-200m` ordinary-control
  sanity check.
- `experiments/perturbation_control/control_examples.csv`: expanded 64-example control set
  with 16 examples per group.

Model registry entries without a corresponding result CSV are treated as planned or ongoing, not
as completed evidence.

## Rebuild

From the repository root:

```bash
python article_perturbation_calibration/build_assets.py
cd article_perturbation_calibration
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

The main new proposal is the ordinary-calibrated gap (OCG): the synonym-random gap for an
idiomatic/compositional group divided by the average synonym-random gap on ordinary single-word and
ordinary two-word controls for the same model and representation level.
