#!/usr/bin/env python3
"""Expose the original English and Portuguese NCIMP data as read-only Studio references.

The source repository snapshot is preserved exactly, including the documented EN
281/279/raw-vs-score anomaly.  No row is silently removed to force the paper's
official count of 280.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from idiomaticity.data import load_comp_scores, make_substitution  # noqa: E402

DATA = ROOT / "data" / "ncimp"
OUT_JSON = ROOT / "studio" / "public" / "references" / "ncimp_en_pt_reference.json"
OUT_CSV = ROOT / "studio" / "public" / "references" / "ncimp_en_pt_reference.csv"
SOURCE_URL = "https://github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations"

OFFICIAL_COUNTS = {"EN": 280, "PT": 180}
NATURAL_FILES = [("naturalistics_examplesent1.csv", "S1"),
                 ("naturalistics_examplesent2.csv", "S2"),
                 ("naturalistics_examplesent3.csv", "S3")]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def variant(row: dict[str, str], column: str, phrase: str = "") -> dict[str, Any] | None:
    sentence = (row.get(column) or "").strip()
    if not sentence:
        return None
    substitution = make_substitution(sentence, row.get(column + "_tag"), phrase=phrase)
    if substitution is None:
        return None
    return {
        "sentence": substitution.sentence,
        "targetSurface": substitution.target_text(),
        "span": list(substitution.span),
        "sourceColumn": column,
    }


def natural_word_synonym_columns(row: dict[str, str]) -> list[str]:
    columns = []
    for column in row:
        if column.endswith("_tag"):
            continue
        if column == "synonym both" or re.fullmatch(r"both synonym alt\d+(?:_\d+)?", column):
            columns.append(column)
    return columns[:5]


def random_columns(row: dict[str, str]) -> list[str]:
    preferred = [f"nc rand freq sentence{index}" for index in range(1, 6)]
    return [column for column in preferred if row.get(column)]


def probes_for(row: dict[str, str], words_columns: list[str], *, plural: bool = False, lang: str) -> dict[str, list[dict[str, Any]]]:
    if plural:
        syn_columns = ["synonym for compoundplural"] if lang == "EN" else ["mwe synonym plural"]
        comp_columns = ["head only plural"]
    else:
        syn_columns = ["synonym for compound"]
        comp_columns = ["original head only", "original modifier only"]
    columns_by_kind = {
        "P_Syn": syn_columns,
        "P_Comp": comp_columns,
        "P_WordsSyn": words_columns,
        "P_Rand": random_columns(row),
    }
    return {
        kind: [item for column in columns if (item := variant(row, column)) is not None]
        for kind, columns in columns_by_kind.items()
    }


def build_language(lang: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    lang_dir = DATA / lang
    scores, classes = load_comp_scores(str(DATA / "human_compositionality scores.xlsx"), lang)
    items: OrderedDict[str, dict[str, Any]] = OrderedDict()

    for file_name, slot in NATURAL_FILES:
        for row in read_csv(lang_dir / file_name):
            canonical = row["compound"].strip()
            key = canonical.casefold()
            if key not in items:
                parts = canonical.split(maxsplit=1)
                items[key] = {
                    "id": f"{lang}-REF-{len(items) + 1:03d}",
                    "language": lang,
                    "canonicalForm": canonical,
                    "modifier": parts[0],
                    "head": parts[1] if len(parts) == 2 else "",
                    "goldClass": classes.get(key),
                    "goldScore": scores.get(key),
                    "scoreStatus": "human_type_score" if key in scores else "missing_in_local_score_workbook",
                    "contexts": [],
                }
            original = variant(row, "original sentence", phrase=row.get("compound noun", ""))
            if original is None:
                continue
            items[key]["contexts"].append({
                "id": f"{items[key]['id']}-{slot}",
                "slot": slot,
                "family": "naturalistic",
                "original": original,
                "probes": probes_for(row, natural_word_synonym_columns(row), lang=lang),
                "sourceFile": file_name,
            })

    neutral_rows = read_csv(lang_dir / "neutral.csv")
    for row in neutral_rows:
        key = row["compound"].strip().casefold()
        if key not in items:
            continue
        singular = variant(row, "neutral sentence", phrase=row.get("compound noun", ""))
        if singular:
            words = ["synonym both"]
            if lang == "EN":
                words += [f"both synonym alt{index}" for index in range(1, 5)]
            items[key]["contexts"].append({
                "id": f"{items[key]['id']}-N1", "slot": "N1", "family": "neutral",
                "original": singular, "probes": probes_for(row, words, lang=lang),
                "sourceFile": "neutral.csv",
            })
        plural = variant(row, "neutral sentence plural", phrase=row.get("compound noun", ""))
        if plural:
            words = ["synonym both plural"] if lang == "EN" else ["both synonyms plural"]
            items[key]["contexts"].append({
                "id": f"{items[key]['id']}-N2", "slot": "N2", "family": "neutral",
                "original": plural, "probes": probes_for(row, words, plural=True, lang=lang),
                "sourceFile": "neutral.csv",
            })

    result = list(items.values())
    class_counts = Counter(item["goldClass"] or "unscored" for item in result)
    summary = {
        "officialPaperMweCount": OFFICIAL_COUNTS[lang],
        "rawSnapshotMweCount": len(result),
        "scoredMweCount": sum(item["goldScore"] is not None for item in result),
        "unscoredMweCount": sum(item["goldScore"] is None for item in result),
        "contextCount": sum(len(item["contexts"]) for item in result),
        "naturalContextCount": sum(c["family"] == "naturalistic" for item in result for c in item["contexts"]),
        "neutralContextCount": sum(c["family"] == "neutral" for item in result for c in item["contexts"]),
        "classCountsFromLocalWorkbook": dict(sorted(class_counts.items())),
    }
    return result, summary


def write_flat_csv(items: list[dict[str, Any]]) -> None:
    fields = [
        "id", "language", "canonical_form", "modifier", "head", "gold_class", "gold_score",
        "score_status", "slot", "family", "original_sentence", "target_surface", "span",
        "p_syn", "p_comp", "p_words_syn", "p_rand", "source_file", "source_url",
    ]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for item in items:
            for context in item["contexts"]:
                writer.writerow({
                    "id": item["id"], "language": item["language"],
                    "canonical_form": item["canonicalForm"], "modifier": item["modifier"], "head": item["head"],
                    "gold_class": item["goldClass"] or "", "gold_score": item["goldScore"] if item["goldScore"] is not None else "",
                    "score_status": item["scoreStatus"], "slot": context["slot"], "family": context["family"],
                    "original_sentence": context["original"]["sentence"],
                    "target_surface": context["original"]["targetSurface"],
                    "span": json.dumps(context["original"]["span"]),
                    "p_syn": " || ".join(v["targetSurface"] for v in context["probes"]["P_Syn"]),
                    "p_comp": " || ".join(v["targetSurface"] for v in context["probes"]["P_Comp"]),
                    "p_words_syn": " || ".join(v["targetSurface"] for v in context["probes"]["P_WordsSyn"]),
                    "p_rand": " || ".join(v["targetSurface"] for v in context["probes"]["P_Rand"]),
                    "source_file": context["sourceFile"], "source_url": SOURCE_URL,
                })


def main() -> None:
    all_items: list[dict[str, Any]] = []
    summaries: dict[str, Any] = {}
    items_by_language: dict[str, list[dict[str, Any]]] = {}
    for lang in ("EN", "PT"):
        items, summary = build_language(lang)
        all_items.extend(items)
        items_by_language[lang] = items
        summaries[lang] = summary
    common = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "readOnly": True,
        "source": {
            "title": "NCIMP original repository snapshot",
            "url": SOURCE_URL,
            "scoreFile": "human_compositionality scores.xlsx",
            "license": "upstream repository terms; review required before redistribution",
            "licenseReviewStatus": "review_required",
        },
        "protocol": {
            "primaryAnalysisLevel": "contextual_span",
            "contextSlots": ["S1", "S2", "S3", "N1", "N2"],
            "probeKinds": ["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand"],
            "expectedVariantsPerContext": {"P_Syn": 1, "P_Comp": 2, "P_WordsSyn": 5, "P_Rand": 5},
            "warning": "Raw upstream variants are shown as stored; missing/uneven alternatives are not synthesized.",
        },
        "summary": summaries,
        "knownAnomalies": [
            "The paper reports 280 English MWEs; the current upstream CSV snapshot has 281.",
            "The local score workbook has 279 scored English MWEs; dust storm and small fry are unscored.",
            "Local workbook class counts differ from the paper's balanced experiment-selection counts.",
        ],
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    index_payload = {
        **common,
        "files": {lang: f"/references/ncimp_{lang.lower()}_reference.json" for lang in items_by_language},
    }
    OUT_JSON.write_text(json.dumps(index_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for lang, items in items_by_language.items():
        language_payload = {**common, "language": lang, "summary": summaries[lang], "items": items}
        path = OUT_JSON.with_name(f"ncimp_{lang.lower()}_reference.json")
        path.write_text(json.dumps(language_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_flat_csv(all_items)
    print(json.dumps({"json": str(OUT_JSON.relative_to(ROOT)), "csv": str(OUT_CSV.relative_to(ROOT)), "summary": summaries}, ensure_ascii=False))


if __name__ == "__main__":
    main()
