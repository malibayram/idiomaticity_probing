#!/usr/bin/env python3
"""Build frequency-matched, review-only P_Rand candidates from Turkish data.

The paper's favg=(fNC+fw1+fw2)/3 method is reproduced on one corpus snapshot.
The current candidate universe is the 280 curated real Turkish MWEs, which is
smaller than the original experiment's corpus candidate pool and is therefore
recorded as a methodological limitation rather than silently treated as gold.
"""

from __future__ import annotations

import bz2
import csv
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data/ncimp/TR/turkish_ncimp_inventory.csv"
TATOEBA = ROOT / "data/ncimp/TR/sources/raw/tatoeba_tur_sentences_detailed_2026-06-20.tsv.bz2"
OUTPUT_DIR = ROOT / "studio/public/candidates"
JSON_OUTPUT = OUTPUT_DIR / "tatoeba_random_probe_candidates.json"
CSV_OUTPUT = OUTPUT_DIR / "tatoeba_random_probe_candidates.csv"
CANDIDATES_PER_MWE = 10
STOPWORDS = {
    "ve", "veya", "ile", "bir", "bu", "şu", "için", "olan", "olarak", "çok",
    "kişi", "şey", "durum", "iş", "alan", "yapı", "süreç", "temel", "biçimde",
}


def normalize_token(value: str) -> str:
    value = value.replace("I", "ı").replace("İ", "i").lower()
    return re.sub(r"^\W+|\W+$", "", value, flags=re.UNICODE)


def phrase_pattern(expression: str) -> re.Pattern[str]:
    first, second = expression.split()
    return re.compile(
        rf"(?<!\w){re.escape(first)}\s+{re.escape(second)}[\w’']*(?!\w)",
        flags=re.IGNORECASE,
    )


def read_inventory() -> list[dict[str, str]]:
    with INVENTORY.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def corpus_frequencies(rows: list[dict[str, str]]) -> tuple[int, Counter[str], Counter[str]]:
    word_counts: Counter[str] = Counter()
    phrase_counts: Counter[str] = Counter()
    patterns = {row["mwe_id"]: phrase_pattern(row["canonical_form"]) for row in rows}
    first_index: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        first_index[normalize_token(row["modifier"])].append(row["mwe_id"])
    token_total = 0
    with bz2.open(TATOEBA, "rt", encoding="utf-8") as handle:
        for raw in handle:
            fields = raw.rstrip("\n").split("\t")
            if len(fields) < 3 or fields[1] != "tur":
                continue
            sentence = fields[2]
            tokens = [normalize_token(token) for token in sentence.split()]
            tokens = [token for token in tokens if token]
            token_total += len(tokens)
            word_counts.update(tokens)
            first_words = set(tokens) & first_index.keys()
            for first in first_words:
                for mwe_id in first_index[first]:
                    if patterns[mwe_id].search(sentence):
                        phrase_counts[mwe_id] += 1
    return token_total, word_counts, phrase_counts


def meaning_words(value: str) -> set[str]:
    return {
        normalize_token(word)
        for word in value.split()
        if len(normalize_token(word)) >= 4 and normalize_token(word) not in STOPWORDS
    }


def stable_tie_break(target_id: str, candidate_id: str) -> str:
    return hashlib.sha256(f"{target_id}:{candidate_id}:20260623".encode()).hexdigest()


def build(
    rows: list[dict[str, str]],
    token_total: int,
    word_counts: Counter[str],
    phrase_counts: Counter[str],
) -> list[dict[str, Any]]:
    stats: dict[str, dict[str, float]] = {}
    scale = 1_000_000 / token_total
    for row in rows:
        modifier_frequency = word_counts[normalize_token(row["modifier"])] * scale
        head_frequency = word_counts[normalize_token(row["head"])] * scale
        compound_frequency = phrase_counts[row["mwe_id"]] * scale
        stats[row["mwe_id"]] = {
            "compoundFrequencyPerMillion": compound_frequency,
            "modifierFrequencyPerMillion": modifier_frequency,
            "headFrequencyPerMillion": head_frequency,
            "averageFrequencyPerMillion": (compound_frequency + modifier_frequency + head_frequency) / 3,
        }

    items: list[dict[str, Any]] = []
    for target in rows:
        target_id = target["mwe_id"]
        target_components = {normalize_token(target["modifier"]), normalize_token(target["head"])}
        target_meaning = meaning_words(target["meaning_tr"])
        target_average = stats[target_id]["averageFrequencyPerMillion"]
        eligible: list[tuple[float, str, dict[str, str]]] = []
        for candidate in rows:
            candidate_id = candidate["mwe_id"]
            if candidate_id == target_id:
                continue
            candidate_components = {normalize_token(candidate["modifier"]), normalize_token(candidate["head"])}
            if target_components & candidate_components:
                continue
            if target_meaning & meaning_words(candidate["meaning_tr"]):
                continue
            candidate_average = stats[candidate_id]["averageFrequencyPerMillion"]
            log_delta = abs(math.log1p(target_average) - math.log1p(candidate_average))
            eligible.append((log_delta, stable_tie_break(target_id, candidate_id), candidate))
        eligible.sort(key=lambda item: (item[0], item[1]))
        candidates = []
        for rank, (log_delta, _tie, candidate) in enumerate(eligible[:CANDIDATES_PER_MWE], start=1):
            candidate_stats = stats[candidate["mwe_id"]]
            candidates.append(
                {
                    "id": f"{target_id}-tatoeba-rand-{rank:02d}",
                    "kind": "P_Rand",
                    "lexicalForm": candidate["canonical_form"],
                    "sourceMweId": candidate["mwe_id"],
                    "source": "Curated TR MWE pool; Tatoeba frequency snapshot",
                    "sourceId": "SRC-002",
                    "rank": rank,
                    "frequency": candidate_stats["compoundFrequencyPerMillion"],
                    "averageFrequency": candidate_stats["averageFrequencyPerMillion"],
                    "targetAverageFrequency": target_average,
                    "logFrequencyDelta": log_delta,
                    "componentOverlap": False,
                    "meaningTokenOverlap": [],
                    "reviewStatus": "review_required",
                    "semanticReviewStatus": "not_reviewed",
                    "grammarReviewStatus": "not_reviewed",
                    "license": "Candidate form from project inventory; counts from Tatoeba CC BY 2.0 FR",
                    "licenseReviewStatus": "mixed_inventory_and_verified_open_frequency_source",
                    "notes": "Human must confirm semantic unrelatedness and contextual grammar.",
                }
            )
        items.append(
            {
                "mweId": target_id,
                "canonicalForm": target["canonical_form"],
                "targetFrequency": stats[target_id],
                "candidates": candidates,
            }
        )
    return items


def main() -> None:
    if not TATOEBA.exists():
        raise SystemExit(f"Missing Tatoeba snapshot: {TATOEBA}")
    rows = read_inventory()
    token_total, word_counts, phrase_counts = corpus_frequencies(rows)
    items = build(rows, token_total, word_counts, phrase_counts)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(UTC).isoformat(),
        "projectId": "tr-ncimp",
        "source": {
            "id": "SRC-002",
            "title": "Tatoeba Turkish sentence export",
            "snapshot": "data/ncimp/TR/sources/raw/tatoeba_tur_sentences_detailed_2026-06-20.tsv.bz2",
            "license": "CC BY 2.0 FR",
            "tokenCount": token_total,
        },
        "method": {
            "formula": "favg=(fNC+fw1+fw2)/3",
            "frequencyUnit": "occurrences per million surface tokens",
            "distance": "absolute log1p average-frequency difference",
            "candidateUniverse": "the other curated MWEs in the 280-item TR inventory",
            "candidateCountPerMwe": CANDIDATES_PER_MWE,
            "autoApproval": False,
            "limitations": [
                "Surface counts are not morphologically lemmatized.",
                "The 280-item curated candidate universe is smaller than a corpus-wide Turkish nominal-compound inventory.",
                "Meaning-token and component-overlap filters do not replace human semantic review.",
            ],
        },
        "summary": {
            "mweCount": len(items),
            "candidateCount": sum(len(item["candidates"]) for item in items),
            "mwesWithFiveOrMoreCandidates": sum(len(item["candidates"]) >= 5 for item in items),
            "zeroCompoundFrequencyMwes": sum(item["targetFrequency"]["compoundFrequencyPerMillion"] == 0 for item in items),
        },
        "items": items,
    }
    JSON_OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fields = [
        "id", "mweId", "canonicalForm", "kind", "lexicalForm", "sourceMweId", "rank",
        "frequency", "averageFrequency", "targetAverageFrequency", "logFrequencyDelta",
        "reviewStatus", "semanticReviewStatus", "grammarReviewStatus", "source", "sourceId",
        "license", "licenseReviewStatus", "notes",
    ]
    with CSV_OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for item in items:
            for candidate in item["candidates"]:
                writer.writerow({"mweId": item["mweId"], "canonicalForm": item["canonicalForm"], **{key: candidate[key] for key in fields if key not in {"mweId", "canonicalForm"}}})
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
    print(f"Wrote {JSON_OUTPUT.relative_to(ROOT)}")
    print(f"Wrote {CSV_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
