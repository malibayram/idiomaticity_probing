#!/usr/bin/env python3
"""Download the NCIMP dataset from the original repository.

Fetches the EN/PT NCIMP CSVs and the human compositionality xlsx from
https://github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations into ``--out``,
laid out as the unified loader expects:

    <out>/EN/naturalistics_examplesent{1,2,3}.csv, neutral.csv
    <out>/PT/naturalistics_examplesent{1,2,3}.csv, neutral.csv
    <out>/human_compositionality scores.xlsx

If a file is missing upstream it is skipped with a warning (the repo layout may change).
"""

from __future__ import annotations

import argparse
import os
import sys

RAW = (
    "https://raw.githubusercontent.com/"
    "risehnhew/Finding-Idiomaticity-in-Word-Representations/main"
)

FILES = {
    "EN": [
        "dataset/EN/naturalistics_examplesent1.csv",
        "dataset/EN/naturalistics_examplesent2.csv",
        "dataset/EN/naturalistics_examplesent3.csv",
        "dataset/EN/neutral.csv",
    ],
    "PT": [
        "dataset/PT/naturalistics_examplesent1.csv",
        "dataset/PT/naturalistics_examplesent2.csv",
        "dataset/PT/naturalistics_examplesent3.csv",
        "dataset/PT/neutral.csv",
    ],
    "ROOT": [
        "dataset/human_compositionality scores.xlsx",
        "dataset/Description.md",
    ],
}


def fetch(rel_path: str, out_dir: str) -> bool:
    import requests

    url = f"{RAW}/{rel_path.replace(' ', '%20')}"
    # Strip the leading "dataset/" so files land directly under <out>.
    local_rel = rel_path[len("dataset/"):] if rel_path.startswith("dataset/") else rel_path
    dest = os.path.join(out_dir, local_rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        resp = requests.get(url, timeout=60)
        if resp.status_code != 200:
            print(f"  WARN {resp.status_code}: {rel_path}")
            return False
        with open(dest, "wb") as fh:
            fh.write(resp.content)
        print(f"  ok: {local_rel} ({len(resp.content)} bytes)")
        return True
    except Exception as exc:
        print(f"  ERROR {rel_path}: {exc}")
        return False


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="data/ncimp", help="Output directory.")
    ap.add_argument("--langs", nargs="+", default=["EN", "PT"])
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ok = 0
    total = 0
    for group in args.langs + ["ROOT"]:
        for rel in FILES.get(group, []):
            total += 1
            ok += fetch(rel, args.out)
    print(f"\nDownloaded {ok}/{total} files into {args.out}")
    if ok == 0:
        print("Nothing downloaded. Check network or repo layout; you can still use "
              "data/sample for a smoke test.")
        sys.exit(1)


if __name__ == "__main__":
    main()
