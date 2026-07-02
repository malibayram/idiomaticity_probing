#!/usr/bin/env python3
"""Build the browser/Firestore seed used by NCIMP Research Studio.

The source CSV files remain authoritative. This script only normalizes them to
the application contract and deliberately marks generated N2 neutral contexts
as review-required. It never edits the source inventory.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data/ncimp/TR/turkish_ncimp_inventory.csv"
SOURCE_MANIFEST = ROOT / "data/ncimp/TR/sources/source_manifest.csv"
OUTPUT = ROOT / "studio/public/seed/tr_project.json"
RESULTS_DATASET = ROOT / "studio/public/results/run_indicators.json"
PROJECT_ID = "tr-ncimp"
PROTOCOL_VERSION = "ncimp-ordinary-calibrated-v2"


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _trim_punctuation(value: str) -> str:
    start, end = 0, len(value)
    while start < end and unicodedata.category(value[start]).startswith(("P", "S")):
        start += 1
    while end > start and unicodedata.category(value[end - 1]).startswith(("P", "S")):
        end -= 1
    return value[start:end].casefold()


def locate_span(sentence: str, surface: str) -> list[int] | None:
    """Locate an exact/normalized whitespace-token span as [start, end)."""
    sentence_tokens = list(re.finditer(r"\S+", sentence))
    target_tokens = surface.split()
    if not sentence_tokens or not target_tokens:
        return None

    normalized_sentence = [_trim_punctuation(match.group()) for match in sentence_tokens]
    normalized_target = [_trim_punctuation(token) for token in target_tokens]
    width = len(normalized_target)
    for index in range(len(normalized_sentence) - width + 1):
        if normalized_sentence[index : index + width] == normalized_target:
            return [index, index + width]

    # Surface strings are curated and normally occur verbatim. This fallback
    # handles punctuation attached inside the recorded surface string.
    folded_sentence = sentence.casefold()
    folded_surface = surface.casefold().strip()
    char_start = folded_sentence.find(folded_surface)
    if char_start < 0:
        return None
    char_end = char_start + len(folded_surface)
    covered = [
        index
        for index, token in enumerate(sentence_tokens)
        if token.start() < char_end and token.end() > char_start
    ]
    return [covered[0], covered[-1] + 1] if covered else None


def _natural_context(row: dict[str, str], number: int) -> dict:
    sentence = row[f"example_{number}"].strip()
    surface = row[f"example_{number}_target_surface"].strip()
    origin = row[f"example_{number}_origin"].strip()
    sense_status = row[f"example_{number}_sense_review_status"].strip()
    approved_sense = {
        "authored_meaning_checked",
        "manually_reviewed_target_sense",
        "exact_match_low_ambiguity",
    }
    source_name = row[f"example_{number}_source_name"].strip()
    source_id = "SRC-002" if source_name == "Tatoeba Turkish sentences" else None
    return {
        "id": f"{row['mwe_id']}-S{number}",
        "slot": f"S{number}",
        "family": "naturalistic",
        "sentence": sentence,
        "targetSurface": surface,
        "span": locate_span(sentence, surface),
        "provenance": {
            "origin": origin,
            "sourceId": source_id,
            "sourceName": source_name or "Dataset authors",
            "sourceUrl": row[f"example_{number}_source_url"].strip() or None,
            "author": row[f"example_{number}_source_author"].strip() or None,
            "license": row[f"example_{number}_source_license"].strip() or "Original text; dataset license not yet assigned",
            "licenseReviewStatus": row[f"example_{number}_license_review_status"].strip(),
            "senseReviewStatus": sense_status,
        },
        "reviewStatus": "approved" if sense_status in approved_sense else "review_required",
    }


def _neutral_contexts(row: dict[str, str]) -> list[dict]:
    canonical = row["canonical_form"].strip()
    n1_sentence = row["neutral_sentence"].strip()
    n1_status = row["neutral_sentence_review_status"].strip()
    n2_sentence = f"Bu, {canonical} denen şeydir."
    common_provenance = {
        "origin": "authored_for_dataset",
        "sourceId": None,
        "sourceName": "Dataset authors",
        "sourceUrl": None,
        "author": None,
        "license": "Original text; dataset license not yet assigned",
        "licenseReviewStatus": "not_external_original_text",
        "senseReviewStatus": "sense_neutral_template",
    }
    return [
        {
            "id": f"{row['mwe_id']}-N1",
            "slot": "N1",
            "family": "neutral",
            "sentence": n1_sentence,
            "targetSurface": canonical,
            "span": locate_span(n1_sentence, canonical),
            "provenance": common_provenance,
            "reviewStatus": "approved" if n1_status == "manual_turkish_structure_override" else "review_required",
        },
        {
            "id": f"{row['mwe_id']}-N2",
            "slot": "N2",
            "family": "neutral",
            "sentence": n2_sentence,
            "targetSurface": canonical,
            "span": locate_span(n2_sentence, canonical),
            "provenance": {**common_provenance, "origin": "generated"},
            "reviewStatus": "review_required",
        },
    ]


def _replace_span_draft(
    sentence: str,
    span: list[int],
    replacement: str,
) -> tuple[str, str, list[int]]:
    """Make a review-required whitespace-token replacement, preserving edge punctuation."""
    tokens = sentence.split()
    start, end = span
    original_first, original_last = tokens[start], tokens[end - 1]
    leading = re.match(r"^([^\wÇĞİÖŞÜçğıöşü]*)", original_first).group(1)
    trailing = re.search(r"([^\wÇĞİÖŞÜçğıöşü']*)$", original_last).group(1)
    replacement_tokens = replacement.split()
    replacement_tokens[0] = leading + replacement_tokens[0]
    replacement_tokens[-1] = replacement_tokens[-1] + trailing
    new_tokens = tokens[:start] + replacement_tokens + tokens[end:]
    surface = " ".join(replacement_tokens).strip(".,;:!?\"“”()[]{}")
    return " ".join(new_tokens), surface, [start, start + len(replacement_tokens)]


def _draft_variants(contexts: list[dict], probes: list[dict]) -> list[dict]:
    variants: list[dict] = []
    for context in contexts:
        if context["span"] is None:
            continue
        for probe in probes:
            sentence, surface, span = _replace_span_draft(
                context["sentence"],
                context["span"],
                probe["lexicalForm"],
            )
            variants.append(
                {
                    "id": f"{context['id']}-{probe['id']}",
                    "contextId": context["id"],
                    "probeKind": probe["kind"],
                    "candidateId": probe["id"],
                    "sentence": sentence,
                    "targetSurface": surface,
                    "span": span,
                    "grammarReviewStatus": "review_required",
                }
            )
    return variants


def build_mwes(rows: list[dict[str, str]]) -> list[dict]:
    mwes: list[dict] = []
    for row in rows:
        natural = [_natural_context(row, index) for index in (1, 2, 3)]
        contexts = natural + _neutral_contexts(row)
        external_count = sum(
            context["provenance"]["origin"] == "internet_open_license"
            for context in natural
        )
        natural_ready = all(
            context["span"] is not None and context["reviewStatus"] == "approved"
            for context in natural
        )
        probes = [
            {
                "id": f"{row['mwe_id']}-comp-modifier",
                "kind": "P_Comp",
                "lexicalForm": row["modifier"].strip(),
                "source": "canonical_component",
                "reviewStatus": "review_required",
                "rank": 1,
            },
            {
                "id": f"{row['mwe_id']}-comp-head",
                "kind": "P_Comp",
                "lexicalForm": row["head"].strip(),
                "source": "canonical_component",
                "reviewStatus": "review_required",
                "rank": 2,
            },
        ]
        mwes.append(
            {
                "id": row["mwe_id"],
                "projectId": PROJECT_ID,
                "language": "TR",
                "canonicalForm": row["canonical_form"].strip(),
                "modifier": row["modifier"].strip(),
                "head": row["head"].strip(),
                "tokenCount": int(row["token_count"]),
                "meaning": row["meaning_tr"].strip(),
                "provisionalClass": row["comp_class_provisional"].strip(),
                "goldClass": None,
                "goldScore": None,
                "workflowStatus": "examples_ready" if external_count >= 1 and natural_ready else "draft",
                "annotationStatus": row["annotation_status"].strip(),
                "contexts": contexts,
                "probes": probes,
                "variants": _draft_variants(contexts, probes),
                "notes": row["curation_notes"].strip(),
                "revision": 1,
                "updatedAt": row["accessed_at"].strip() or "2026-06-23",
            }
        )
    return mwes


def build_sources(rows: list[dict[str, str]]) -> list[dict]:
    return [
        {
            "id": row["source_id"],
            "title": row["title"],
            "category": row["category"],
            "status": row["status"],
            "priority": row["priority"],
            "url": row["url"],
            "paperUrl": row["paper_url"] or None,
            "license": row["license_or_terms"],
            "observedSize": row["observed_size"],
            "useForNcimp": row["use_for_ncimp"],
            "notes": row["notes"],
            "lastChecked": row["last_checked"],
        }
        for row in rows
    ]


def build_runs() -> list[dict]:
    if not RESULTS_DATASET.exists():
        raise FileNotFoundError(
            "Article-aligned results are missing; run scripts/build_results_dataset.py first."
        )
    payload = json.loads(RESULTS_DATASET.read_text(encoding="utf-8"))
    calibration = {
        (row["model"], row["language"]): row for row in payload["calibration"]
    }
    runs: list[dict] = []
    for row in payload["diagnostics"]:
        language = row["language"]
        cal = calibration.get((row["model"], language))
        run = {
            "id": "-".join([language, row["model"], "article-diagnostic"]).replace("/", "-").replace(" ", "-"),
            "model": row["model"],
            "language": language,
            "context": "naturalistic+neutral",
            "level": row["representationLevel"],
            "family": row["family"],
            "cohort": row["cohort"],
            "studyExperiment": row["studyExperiment"],
            "year": row["year"],
            "trainingStage": row["trainingStage"],
            "isc": row["isc"], "ig": row["ig"], "lod": row["lod"],
            "aid": row["aid"], "floor": row["floor"], "rho": row["rho"],
            "ics": row["ics"],
            "anisotropyWarning": row["anisotropyWarning"],
            "status": "imported",
        }
        if row.get("runtime"):
            run["runtime"] = row["runtime"]
        if cal:
            run.update({
                "idiomGap": cal["idiomGap"],
                "compositionalGap": cal["compositionalGap"],
                "ordinaryGap": cal["ordinaryGap"],
                "ocgIdiom": cal["ocgIdiom"],
                "ocgCompositional": cal["ocgCompositional"],
            })
        runs.append(run)
    return runs


def build_snapshot() -> dict:
    inventory_rows = _read_csv(INVENTORY)
    source_rows = _read_csv(SOURCE_MANIFEST)
    mwes = build_mwes(inventory_rows)
    generated_at = datetime.now(UTC).isoformat()
    return {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "project": {
            "id": PROJECT_ID,
            "name": "Türkçe NCIMP Genişletmesi",
            "language": "TR",
            "protocolVersion": PROTOCOL_VERSION,
            "readOnly": False,
            "targetMweCount": 280,
            "targetSentenceCount": 19_600,
            "articleSource": "article_perturbation_calibration/main.tex",
            "primaryAnalysisLevel": "contextual_span",
            "requiredMetrics": ["ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS", "OCG"],
        },
        "mwes": mwes,
        "sources": build_sources(source_rows),
        "campaigns": [
            {
                "id": "tr-type-pilot-v1",
                "name": "TR Type Pilot - 30 MWE",
                "taskType": "type",
                "status": "draft",
                "targetAnnotators": 2,
                "itemCount": 30,
                "completedAssignments": 0,
                "totalAssignments": 60,
            },
            {
                "id": "tr-token-pilot-v1",
                "name": "TR Token Pilot - 90 Bağlam",
                "taskType": "token",
                "status": "draft",
                "targetAnnotators": 2,
                "itemCount": 90,
                "completedAssignments": 0,
                "totalAssignments": 180,
            },
        ],
        "assignments": [],
        "annotations": [],
        "ordinaryControlReviews": [],
        "jobs": [
            {
                "id": "initial-tr-import",
                "type": "import",
                "title": "Türkçe envanter ve kaynak manifesti",
                "status": "succeeded",
                "progress": 100,
                "createdAt": generated_at,
                "finishedAt": generated_at,
                "payload": {"mweCount": len(mwes), "sourceCount": len(source_rows)},
            }
        ],
        "runs": build_runs(),
    }


def validate(snapshot: dict) -> None:
    mwes = snapshot["mwes"]
    assert len(mwes) == 280, len(mwes)
    assert len({record["canonicalForm"].casefold() for record in mwes}) == 280
    assert Counter(record["provisionalClass"] for record in mwes) == {
        "I": 103,
        "PC": 88,
        "C": 89,
    }
    assert all(len(record["contexts"]) == 5 for record in mwes)
    assert all(
        [context["slot"] for context in record["contexts"]]
        == ["S1", "S2", "S3", "N1", "N2"]
        for record in mwes
    )
    missing_spans = [
        (record["id"], context["slot"])
        for record in mwes
        for context in record["contexts"]
        if context["span"] is None
    ]
    assert not missing_spans, missing_spans[:20]


def main() -> None:
    snapshot = build_snapshot()
    validate(snapshot)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(OUTPUT.relative_to(ROOT)),
                "mwes": len(snapshot["mwes"]),
                "contexts": sum(len(record["contexts"]) for record in snapshot["mwes"]),
                "sources": len(snapshot["sources"]),
                "referenceRuns": len(snapshot["runs"]),
                "examplesReady": sum(
                    record["workflowStatus"] == "examples_ready"
                    for record in snapshot["mwes"]
                ),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
