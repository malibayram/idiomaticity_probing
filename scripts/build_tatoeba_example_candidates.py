#!/usr/bin/env python3
"""Build a provenance-preserving Tatoeba example review pool.

The authoritative inventory remains untouched. Exact surface matches are only
candidates because an idiomatic MWE may have a literal homograph. Existing
inventory selections are linked back to their S1/S2/S3 slots.
"""

from __future__ import annotations

import bz2
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data/ncimp/TR/turkish_ncimp_inventory.csv"
TATOEBA = ROOT / "data/ncimp/TR/sources/raw/tatoeba_tur_sentences_detailed_2026-06-20.tsv.bz2"
OUTPUT_DIR = ROOT / "studio/public/candidates"
JSON_OUTPUT = OUTPUT_DIR / "tatoeba_example_candidates.json"
CSV_OUTPUT = OUTPUT_DIR / "tatoeba_example_candidates.csv"
MAX_MATCHES_PER_MWE = 100


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("I", "ı").replace("İ", "i").lower()).strip()


def target_pattern(expression: str) -> re.Pattern[str]:
    first, second = expression.split()
    return re.compile(
        rf"(?<!\w){re.escape(first)}\s+{re.escape(second)}[\w’']*(?!\w)",
        flags=re.IGNORECASE,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_inventory() -> list[dict[str, str]]:
    with INVENTORY.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def selected_sentences(rows: list[dict[str, str]]) -> dict[tuple[str, str], str]:
    selected: dict[tuple[str, str], str] = {}
    for row in rows:
        for number in (1, 2, 3):
            if row[f"example_{number}_origin"] != "internet_open_license":
                continue
            selected[(row["mwe_id"], normalize(row[f"example_{number}"]))] = f"S{number}"
    return selected


def collect(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    patterns = {row["mwe_id"]: target_pattern(row["canonical_form"]) for row in rows}
    by_id = {row["mwe_id"]: row for row in rows}
    first_index: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        first_index[normalize(row["canonical_form"].split()[0])].append(row["mwe_id"])
    selected = selected_sentences(rows)
    found: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_ids: set[tuple[str, str]] = set()

    with bz2.open(TATOEBA, "rt", encoding="utf-8") as handle:
        for raw in handle:
            fields = raw.rstrip("\n").split("\t")
            if len(fields) < 4:
                continue
            sentence_id, language, sentence, author = fields[:4]
            if language != "tur" or not 5 <= len(sentence.split()) <= 40:
                continue
            sentence_words = {
                normalize(re.sub(r"^\W+|\W+$", "", token))
                for token in sentence.split()
            }
            for first in sentence_words & first_index.keys():
                for mwe_id in first_index[first]:
                    if len(found[mwe_id]) >= MAX_MATCHES_PER_MWE:
                        continue
                    if (mwe_id, sentence_id) in seen_ids:
                        continue
                    match = patterns[mwe_id].search(sentence)
                    if not match:
                        continue
                    row = by_id[mwe_id]
                    selected_slot = selected.get((mwe_id, normalize(sentence)))
                    found[mwe_id].append(
                        {
                            "id": f"{mwe_id}-tatoeba-{sentence_id}",
                            "mweId": mwe_id,
                            "canonicalForm": row["canonical_form"],
                            "provisionalClass": row["comp_class_provisional"],
                            "sentence": sentence,
                            "targetSurface": match.group(0),
                            "sourceId": "SRC-002",
                            "sourceRecordId": sentence_id,
                            "sourceName": "Tatoeba Turkish sentences",
                            "sourceUrl": f"https://tatoeba.org/en/sentences/show/{sentence_id}",
                            "author": author or None,
                            "license": "CC BY 2.0 FR",
                            "licenseReviewStatus": "verified_open_license",
                            "senseReviewStatus": (
                                "already_selected_and_reviewed"
                                if selected_slot
                                else "exact_surface_match_needs_native_review"
                            ),
                            "reviewStatus": "approved" if selected_slot else "review_required",
                            "datasetStatus": "already_selected" if selected_slot else "candidate",
                            "selectedSlot": selected_slot,
                        }
                    )
                    seen_ids.add((mwe_id, sentence_id))
    return [candidate for mwe_id in sorted(found) for candidate in found[mwe_id]]


def summary(rows: list[dict[str, str]], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    by_mwe = Counter(candidate["mweId"] for candidate in candidates)
    by_class = Counter(candidate["provisionalClass"] for candidate in candidates)
    selected = sum(candidate["datasetStatus"] == "already_selected" for candidate in candidates)
    return {
        "mweCount": len(rows),
        "candidateCount": len(candidates),
        "alreadySelectedCount": selected,
        "newReviewCandidateCount": len(candidates) - selected,
        "mwesWithAnyMatch": len(by_mwe),
        "mwesWithoutMatch": len(rows) - len(by_mwe),
        "maxMatchesPerMwe": max(by_mwe.values(), default=0),
        "matchesByProvisionalClass": dict(sorted(by_class.items())),
    }


def write_outputs(rows: list[dict[str, str]], candidates: list[dict[str, Any]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(UTC).isoformat(),
        "projectId": "tr-ncimp",
        "source": {
            "id": "SRC-002",
            "title": "Tatoeba Turkish sentence export",
            "url": "https://tatoeba.org/tr/downloads",
            "snapshot": "data/ncimp/TR/sources/raw/tatoeba_tur_sentences_detailed_2026-06-20.tsv.bz2",
            "snapshotSha256": sha256(TATOEBA),
            "license": "CC BY 2.0 FR",
        },
        "policy": {
            "matchType": "exact_first_component_plus_inflected_head_surface",
            "autoApproval": False,
            "limitPerMwe": MAX_MATCHES_PER_MWE,
            "warning": "Exact surface matches can be literal homographs; unselected candidates require native-speaker sense review.",
        },
        "summary": summary(rows, candidates),
        "candidates": candidates,
    }
    JSON_OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fields = [
        "id", "mweId", "canonicalForm", "provisionalClass", "sentence", "targetSurface",
        "sourceId", "sourceRecordId", "sourceName", "sourceUrl", "author", "license",
        "licenseReviewStatus", "senseReviewStatus", "reviewStatus", "datasetStatus", "selectedSlot",
    ]
    with CSV_OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(candidates)


def main() -> None:
    if not TATOEBA.exists():
        raise SystemExit(f"Missing Tatoeba snapshot: {TATOEBA}")
    rows = read_inventory()
    candidates = collect(rows)
    write_outputs(rows, candidates)
    print(json.dumps(summary(rows, candidates), ensure_ascii=False, indent=2))
    print(f"Wrote {JSON_OUTPUT.relative_to(ROOT)}")
    print(f"Wrote {CSV_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
