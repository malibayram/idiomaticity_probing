#!/usr/bin/env python3
"""Run the local NCIMP Research Studio Firestore worker."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default="cross-lingual-mwe")
    parser.add_argument("--poll-seconds", type=float, default=3.0)
    parser.add_argument("--once", action="store_true")
    parser.add_argument(
        "--local-job",
        help="Firestore olmadan bir JSON job dosyasını güvenli çekirdekte çalıştır.",
    )
    args = parser.parse_args()
    if args.local_job:
        from research_studio_worker.jobs import JobRunner

        job_path = Path(args.local_job).resolve()
        job = json.loads(job_path.read_text(encoding="utf-8"))
        result = JobRunner(ROOT).run(
            job,
            progress=lambda percent, message: print(f"[{percent:3d}%] {message}"),
        )
        print(json.dumps(
            {"status": result.status, "summary": result.summary, "artifacts": result.artifacts},
            ensure_ascii=False,
            indent=2,
        ))
        return

    from research_studio_worker.firestore import FirestoreWorker

    worker = FirestoreWorker(ROOT, project_id=args.project, poll_seconds=args.poll_seconds)
    if args.once:
        worker.process_one()
    else:
        worker.run_forever()


if __name__ == "__main__":
    main()
