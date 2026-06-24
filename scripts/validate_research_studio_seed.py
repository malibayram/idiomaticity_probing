#!/usr/bin/env python3
"""Validate the current Research Studio seed and publish static reports."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from research_studio_worker.validation import report_markdown, validate_snapshot  # noqa: E402


SEED = ROOT / "studio/public/seed/tr_project.json"
REPORT_DIR = ROOT / "studio/public/reports"


def main() -> None:
    snapshot = json.loads(SEED.read_text(encoding="utf-8"))
    report = validate_snapshot(snapshot)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "tr_validation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (REPORT_DIR / "tr_validation.md").write_text(
        report_markdown(report),
        encoding="utf-8",
    )
    print(json.dumps(report["metrics"], ensure_ascii=False))
    print(json.dumps(report["gateCounts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
