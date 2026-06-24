#!/usr/bin/env python3
"""Extract review-only Turkish NCIMP probe candidates from KeNet.

KeNet is a lexical evidence source, not a gold-label source.  This script
matches the curated full MWE, modifier and head forms against exact KeNet
lemmas, retains synset definitions/examples for human sense selection, and
builds bounded P_Syn/P_WordsSyn candidate queues.  Nothing is auto-approved.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data/ncimp/TR/turkish_ncimp_inventory.csv"
KENET_XML = ROOT / "data/ncimp/TR/sources/raw/kenet_2026-06-23.xml"
OUTPUT_DIR = ROOT / "studio/public/candidates"
JSON_OUTPUT = OUTPUT_DIR / "kenet_probe_candidates.json"
CSV_OUTPUT = OUTPUT_DIR / "kenet_probe_candidates.csv"
SOURCE_ID = "SRC-009"
SOURCE_URL = "https://github.com/StarlangSoftware/TurkishWordNet"
MAX_SYNONYMS_PER_COMPONENT = 20
MAX_P_SYN_CANDIDATES = 20
MAX_P_WORDS_SYN_CANDIDATES = 25


def normalize_turkish(value: str) -> str:
    """Normalize a Turkish lexical form without erasing lexical distinctions."""
    value = unicodedata.normalize("NFC", value).translate(str.maketrans({"I": "ı", "İ": "i"}))
    value = value.lower().replace("’", "'")
    return re.sub(r"\s+", " ", value).strip()


def _reverse_softening(stem: str) -> list[str]:
    """Return common Turkish compound-stem consonant alternations."""
    if not stem:
        return []
    replacements = {"b": "p", "c": "ç", "d": "t", "g": "k", "ğ": "k"}
    replacement = replacements.get(stem[-1])
    return [stem[:-1] + replacement] if replacement else []


def component_query_forms(form: str, role: str) -> list[tuple[str, str]]:
    """Produce explicit, reviewable lemma fallbacks for compound components."""
    normalized = normalize_turkish(form)
    candidates: list[tuple[str, str]] = [(normalized, "exact")]

    stems: list[tuple[str, str]] = []
    if role == "head":
        if normalized.endswith(("ları", "leri")) and len(normalized) > 4:
            stems.append((normalized[:-4], "strip_plural_possessive"))
        if len(normalized) > 3 and normalized[-2] == "s" and normalized[-1] in "ıiuü":
            stems.append((normalized[:-2], "strip_buffer_s_possessive"))
        elif len(normalized) > 2 and normalized[-1] in "ıiuü":
            stems.append((normalized[:-1], "strip_possessive"))
    elif role == "modifier":
        for suffix in ("lar", "ler"):
            if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
                stems.append((normalized[: -len(suffix)], "strip_plural"))
        for suffix in ("da", "de", "ta", "te"):
            if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
                stems.append((normalized[: -len(suffix)], "strip_locative"))

    for stem, method in stems:
        candidates.append((stem, method))
        candidates.extend((variant, method + "_reverse_softening") for variant in _reverse_softening(stem))

    unique: list[tuple[str, str]] = []
    seen: set[str] = set()
    for query, method in candidates:
        if query and query not in seen:
            unique.append((query, method))
            seen.add(query)
    return unique


def _read_inventory() -> list[dict[str, str]]:
    with INVENTORY.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _text_children(element: ET.Element, tag: str) -> list[str]:
    values: list[str] = []
    for child in element.findall(tag):
        text = " ".join("".join(child.itertext()).split())
        if text:
            values.append(text)
    return values


def extract_matching_synsets(target_forms: set[str]) -> dict[str, list[dict[str, Any]]]:
    """Stream KeNet and return only synsets containing exact target lemmas."""
    entry_lemmas: dict[str, dict[str, str]] = {}
    matches: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for _event, element in ET.iterparse(KENET_XML, events=("end",)):
        if element.tag == "LexicalEntry":
            lemma = element.find("Lemma")
            if lemma is not None:
                written_form = lemma.get("writtenForm", "").strip()
                if written_form:
                    entry_lemmas[element.get("id", "")] = {
                        "writtenForm": written_form,
                        "partOfSpeech": lemma.get("partOfSpeech", ""),
                    }
            element.clear()
            continue

        if element.tag != "Synset":
            continue

        members = [
            entry_lemmas[member_id]
            for member_id in element.get("members", "").split()
            if member_id in entry_lemmas
        ]
        member_forms = [member["writtenForm"] for member in members]
        normalized_members = {normalize_turkish(form) for form in member_forms}
        relevant_forms = normalized_members & target_forms
        if relevant_forms:
            evidence = {
                "synsetId": element.get("id", ""),
                "partOfSpeech": element.get("partOfSpeech", ""),
                "members": member_forms,
                "definitions": _text_children(element, "Definition"),
                "examples": _text_children(element, "Example"),
            }
            for form in relevant_forms:
                matches[form].append(evidence)
        element.clear()

    return dict(matches)


def collect_component_senses(
    form: str,
    role: str,
    matches: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Collect exact and transparent inflectional-fallback synset evidence."""
    senses: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for query_form, method in component_query_forms(form, role):
        for sense in matches.get(query_form, []):
            key = (sense["synsetId"], query_form)
            if key in seen:
                continue
            senses.append(
                {
                    **sense,
                    "matchedQueryForm": query_form,
                    "matchMethod": method,
                }
            )
            seen.add(key)
    return senses


def _synonyms(form: str, senses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_form = normalize_turkish(form)
    merged: dict[str, dict[str, Any]] = {}
    for sense in senses:
        for member in sense["members"]:
            normalized_member = normalize_turkish(member)
            if not normalized_member or normalized_member == normalized_form:
                continue
            candidate = merged.setdefault(
                normalized_member,
                {
                    "lexicalForm": member,
                    "synsetIds": [],
                    "definitions": [],
                    "examples": [],
                    "partsOfSpeech": [],
                },
            )
            for key, values in (
                ("synsetIds", [sense["synsetId"]]),
                ("definitions", sense["definitions"]),
                ("examples", sense["examples"]),
                ("partsOfSpeech", [sense["partOfSpeech"]]),
            ):
                for value in values:
                    if value and value not in candidate[key]:
                        candidate[key].append(value)
    return sorted(merged.values(), key=lambda item: normalize_turkish(item["lexicalForm"]))


def _candidate(
    *, candidate_id: str, kind: str, lexical_form: str, rank: int,
    component_strategy: str, synset_ids: list[str], definitions: list[str],
    examples: list[str], notes: str,
) -> dict[str, Any]:
    return {
        "id": candidate_id,
        "kind": kind,
        "lexicalForm": lexical_form,
        "sourceId": SOURCE_ID,
        "source": "KeNet Turkish WordNet",
        "sourceUrl": SOURCE_URL,
        "componentStrategy": component_strategy,
        "synsetIds": synset_ids,
        "definitions": definitions,
        "examples": examples,
        "rank": rank,
        "reviewStatus": "review_required",
        "senseReviewStatus": "not_reviewed",
        "grammarReviewStatus": "not_reviewed",
        "license": "GPL-3 (declared by WN-LMF lexicon and repository)",
        "licenseReviewStatus": "content_license_review_required",
        "notes": notes,
    }


def _merge_unique(*groups: list[str]) -> list[str]:
    result: list[str] = []
    for group in groups:
        for value in group:
            if value and value not in result:
                result.append(value)
    return result


def build_items(
    rows: list[dict[str, str]],
    matches: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in rows:
        mwe_id = row["mwe_id"]
        canonical = row["canonical_form"].strip()
        modifier = row["modifier"].strip()
        head = row["head"].strip()
        full_senses = matches.get(normalize_turkish(canonical), [])
        modifier_senses = collect_component_senses(modifier, "modifier", matches)
        head_senses = collect_component_senses(head, "head", matches)
        full_synonyms = _synonyms(canonical, full_senses)
        modifier_synonyms = _synonyms(modifier, modifier_senses)[:MAX_SYNONYMS_PER_COMPONENT]
        head_synonyms = _synonyms(head, head_senses)[:MAX_SYNONYMS_PER_COMPONENT]

        p_syn = [
            _candidate(
                candidate_id=f"{mwe_id}-kenet-syn-{rank:02d}",
                kind="P_Syn",
                lexical_form=synonym["lexicalForm"],
                rank=rank,
                component_strategy="whole_mwe_synonym",
                synset_ids=synonym["synsetIds"],
                definitions=synonym["definitions"],
                examples=synonym["examples"],
                notes="Exact full-MWE lemma match; human must select the intended sense.",
            )
            for rank, synonym in enumerate(full_synonyms[:MAX_P_SYN_CANDIDATES], start=1)
        ]

        p_words_syn: list[dict[str, Any]] = []
        for modifier_synonym in modifier_synonyms:
            for head_synonym in head_synonyms:
                rank = len(p_words_syn) + 1
                lexical_form = f"{modifier_synonym['lexicalForm']} {head_synonym['lexicalForm']}"
                p_words_syn.append(
                    _candidate(
                        candidate_id=f"{mwe_id}-kenet-wordssyn-{rank:02d}",
                        kind="P_WordsSyn",
                        lexical_form=lexical_form,
                        rank=rank,
                        component_strategy="modifier_synonym_plus_head_synonym",
                        synset_ids=_merge_unique(modifier_synonym["synsetIds"], head_synonym["synsetIds"]),
                        definitions=_merge_unique(modifier_synonym["definitions"], head_synonym["definitions"]),
                        examples=_merge_unique(modifier_synonym["examples"], head_synonym["examples"]),
                        notes=(
                            f"Modifier '{modifier}' -> '{modifier_synonym['lexicalForm']}'; "
                            f"head '{head}' -> '{head_synonym['lexicalForm']}'. "
                            "Morphology and sentence grammar require human review."
                        ),
                    )
                )
                if len(p_words_syn) >= MAX_P_WORDS_SYN_CANDIDATES:
                    break
            if len(p_words_syn) >= MAX_P_WORDS_SYN_CANDIDATES:
                break

        items.append(
            {
                "mweId": mwe_id,
                "canonicalForm": canonical,
                "modifier": modifier,
                "head": head,
                "matchSummary": {
                    "fullMweSenseCount": len(full_senses),
                    "modifierSenseCount": len(modifier_senses),
                    "headSenseCount": len(head_senses),
                    "modifierExactSenseCount": sum(sense.get("matchMethod") == "exact" for sense in modifier_senses),
                    "headExactSenseCount": sum(sense.get("matchMethod") == "exact" for sense in head_senses),
                    "fullMweSynonymCount": len(full_synonyms),
                    "modifierSynonymCount": len(modifier_synonyms),
                    "headSynonymCount": len(head_synonyms),
                },
                "senseEvidence": {
                    "fullMwe": full_senses,
                    "modifier": modifier_senses,
                    "head": head_senses,
                },
                "componentSynonyms": {
                    "modifier": modifier_synonyms,
                    "head": head_synonyms,
                },
                "candidates": p_syn + p_words_syn,
            }
        )
    return items


def _summary(items: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "mweCount": len(items),
        "fullMweExactMatchCount": sum(item["matchSummary"]["fullMweSenseCount"] > 0 for item in items),
        "modifierExactMatchCount": sum(item["matchSummary"]["modifierExactSenseCount"] > 0 for item in items),
        "headExactMatchCount": sum(item["matchSummary"]["headExactSenseCount"] > 0 for item in items),
        "modifierAnyMatchCount": sum(item["matchSummary"]["modifierSenseCount"] > 0 for item in items),
        "headAnyMatchCount": sum(item["matchSummary"]["headSenseCount"] > 0 for item in items),
        "mwesWithPSynCandidate": sum(any(c["kind"] == "P_Syn" for c in item["candidates"]) for item in items),
        "mwesWithPWordsSynCandidate": sum(any(c["kind"] == "P_WordsSyn" for c in item["candidates"]) for item in items),
        "pSynCandidateCount": sum(c["kind"] == "P_Syn" for item in items for c in item["candidates"]),
        "pWordsSynCandidateCount": sum(c["kind"] == "P_WordsSyn" for item in items for c in item["candidates"]),
    }


def write_outputs(items: list[dict[str, Any]]) -> dict[str, Any]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(UTC).isoformat(),
        "projectId": "tr-ncimp",
        "source": {
            "id": SOURCE_ID,
            "title": "KeNet Turkish WordNet",
            "url": SOURCE_URL,
            "snapshot": "data/ncimp/TR/sources/raw/kenet_2026-06-23.xml",
            "snapshotSha256": _sha256(KENET_XML),
            "license": "GPL-3",
            "licenseReviewStatus": "content_license_review_required",
        },
        "policy": {
            "matchType": "exact_normalized_lemma",
            "autoApproval": False,
            "pSynLimitPerMwe": MAX_P_SYN_CANDIDATES,
            "pWordsSynLimitPerMwe": MAX_P_WORDS_SYN_CANDIDATES,
            "warning": "Lexical candidates are not gold probes; intended sense and contextual grammar require human approval.",
        },
        "summary": _summary(items),
        "items": items,
    }
    JSON_OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fieldnames = [
        "candidate_id", "mwe_id", "canonical_form", "kind", "lexical_form",
        "component_strategy", "rank", "synset_ids", "definitions", "examples",
        "source_id", "source_url", "license", "license_review_status",
        "sense_review_status", "grammar_review_status", "review_status", "notes",
    ]
    with CSV_OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            for candidate in item["candidates"]:
                writer.writerow(
                    {
                        "candidate_id": candidate["id"],
                        "mwe_id": item["mweId"],
                        "canonical_form": item["canonicalForm"],
                        "kind": candidate["kind"],
                        "lexical_form": candidate["lexicalForm"],
                        "component_strategy": candidate["componentStrategy"],
                        "rank": candidate["rank"],
                        "synset_ids": " | ".join(candidate["synsetIds"]),
                        "definitions": " | ".join(candidate["definitions"]),
                        "examples": " | ".join(candidate["examples"]),
                        "source_id": candidate["sourceId"],
                        "source_url": candidate["sourceUrl"],
                        "license": candidate["license"],
                        "license_review_status": candidate["licenseReviewStatus"],
                        "sense_review_status": candidate["senseReviewStatus"],
                        "grammar_review_status": candidate["grammarReviewStatus"],
                        "review_status": candidate["reviewStatus"],
                        "notes": candidate["notes"],
                    }
                )
    return payload


def main() -> None:
    if not KENET_XML.exists():
        raise SystemExit(f"Missing KeNet snapshot: {KENET_XML}")
    rows = _read_inventory()
    target_forms = {normalize_turkish(row["canonical_form"]) for row in rows}
    for row in rows:
        for role in ("modifier", "head"):
            target_forms.update(query for query, _method in component_query_forms(row[role], role))
    matches = extract_matching_synsets(target_forms)
    payload = write_outputs(build_items(rows, matches))
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
    print(f"Wrote {JSON_OUTPUT.relative_to(ROOT)}")
    print(f"Wrote {CSV_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
