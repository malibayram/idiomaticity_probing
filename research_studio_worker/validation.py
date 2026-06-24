"""Paper-exact dataset validation and release-gate reporting."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from typing import Any, Iterable


EXPECTED_CONTEXTS = ("S1", "S2", "S3", "N1", "N2")
EXPECTED_PROBES = {"P_Syn": 1, "P_Comp": 2, "P_WordsSyn": 5, "P_Rand": 5}
TARGET_MWES = 280
TARGET_SENTENCES = 19_600
TARGET_ANNOTATORS = 8
TARGET_ORDINARY_CONTROLS = 64


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    severity: str
    message: str
    mwe_id: str | None = None
    context_id: str | None = None


def _issue(
    issues: list[ValidationIssue],
    code: str,
    message: str,
    *,
    severity: str = "error",
    mwe_id: str | None = None,
    context_id: str | None = None,
) -> None:
    issues.append(ValidationIssue(code, severity, message, mwe_id, context_id))


def _accepted_annotation_counts(snapshot: dict[str, Any]) -> Counter:
    accepted_assignments = {
        item["id"]: item
        for item in snapshot.get("assignments", [])
        if item.get("status") == "accepted"
    }
    seen = Counter()
    for annotation in snapshot.get("annotations", []):
        assignment = accepted_assignments.get(annotation.get("assignmentId"))
        if not assignment:
            continue
        key = (assignment["mweId"], assignment.get("contextId") or "TYPE")
        seen[key] += 1
    return seen


def validate_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Return a structured, non-destructive validation report."""
    issues: list[ValidationIssue] = []
    mwes = snapshot.get("mwes", [])
    if len(mwes) != TARGET_MWES:
        _issue(issues, "mwe_count", f"Beklenen {TARGET_MWES}, bulunan {len(mwes)} MWE.")

    canonical = [str(item.get("canonicalForm", "")).casefold() for item in mwes]
    duplicates = [value for value, count in Counter(canonical).items() if count > 1]
    if duplicates:
        _issue(issues, "duplicate_mwe", f"{len(duplicates)} yinelenen kanonik ifade var.")

    accepted_counts = _accepted_annotation_counts(snapshot)
    approved_controls = {
        item.get("itemId")
        for item in snapshot.get("ordinaryControlReviews", [])
        if item.get("status") == "approved"
    }
    for index in range(1, TARGET_ORDINARY_CONTROLS + 1):
        item_id = f"TR-CTRL-{index:03d}"
        if item_id not in approved_controls:
            _issue(
                issues,
                "ordinary_control_review",
                "Experiment 4 ordinary-control kaydı semantik/dilbilgisi/frekans incelemesi bekliyor.",
                mwe_id=item_id,
            )
    metrics = Counter()
    total_sentences = 0
    for mwe in mwes:
        mwe_id = mwe.get("id")
        if mwe.get("tokenCount") != 2:
            _issue(issues, "token_count", "İfade iki token değil.", mwe_id=mwe_id)
        contexts = mwe.get("contexts", [])
        slots = tuple(context.get("slot") for context in contexts)
        if slots != EXPECTED_CONTEXTS:
            _issue(
                issues,
                "context_slots",
                f"Beklenen bağlamlar {EXPECTED_CONTEXTS}, bulunan {slots}.",
                mwe_id=mwe_id,
            )
        natural = [context for context in contexts if context.get("family") == "naturalistic"]
        external = sum(
            context.get("provenance", {}).get("origin") == "internet_open_license"
            for context in natural
        )
        metrics["natural_contexts"] += len(natural)
        metrics["external_contexts"] += external
        if external < 1:
            _issue(
                issues,
                "external_example_gate",
                "En az bir korpus kaynaklı doğal örnek gerekli.",
                mwe_id=mwe_id,
            )
        for context in contexts:
            context_id = context.get("id")
            if not context.get("sentence"):
                _issue(issues, "empty_sentence", "Cümle boş.", mwe_id=mwe_id, context_id=context_id)
            span = context.get("span")
            if not isinstance(span, list) or len(span) != 2 or span[0] >= span[1]:
                _issue(issues, "invalid_span", "Hedef span geçersiz.", mwe_id=mwe_id, context_id=context_id)
            if context.get("reviewStatus") != "approved":
                _issue(
                    issues,
                    "context_review",
                    f"{context.get('slot')} bağlamı insan incelemesi bekliyor.",
                    mwe_id=mwe_id,
                    context_id=context_id,
                )
            if context.get("slot") in {"S1", "S2", "S3"}:
                count = accepted_counts[(mwe_id, context_id)]
                if count < TARGET_ANNOTATORS:
                    _issue(
                        issues,
                        "token_annotations",
                        f"Token anotasyonu {count}/{TARGET_ANNOTATORS}.",
                        mwe_id=mwe_id,
                        context_id=context_id,
                    )
            total_sentences += 1

        type_count = accepted_counts[(mwe_id, "TYPE")]
        if type_count < TARGET_ANNOTATORS:
            _issue(
                issues,
                "type_annotations",
                f"Type anotasyonu {type_count}/{TARGET_ANNOTATORS}.",
                mwe_id=mwe_id,
            )
        if mwe.get("goldScore") is None or mwe.get("goldClass") not in {"I", "PC", "C"}:
            _issue(issues, "gold_missing", "Gold skor veya sınıf eksik.", mwe_id=mwe_id)

        approved_probes = Counter(
            probe.get("kind")
            for probe in mwe.get("probes", [])
            if probe.get("reviewStatus") == "approved"
        )
        for kind, expected in EXPECTED_PROBES.items():
            if approved_probes[kind] != expected:
                _issue(
                    issues,
                    "probe_count",
                    f"{kind}: onaylı {approved_probes[kind]}/{expected}.",
                    mwe_id=mwe_id,
                )
        variants = mwe.get("variants", [])
        variant_counts = Counter(
            (variant.get("contextId"), variant.get("probeKind"))
            for variant in variants
            if variant.get("grammarReviewStatus") == "approved"
        )
        for context in contexts:
            for kind, expected in EXPECTED_PROBES.items():
                if variant_counts[(context.get("id"), kind)] != expected:
                    _issue(
                        issues,
                        "variant_count",
                        f"{context.get('slot')} {kind}: onaylı "
                        f"{variant_counts[(context.get('id'), kind)]}/{expected}.",
                        mwe_id=mwe_id,
                        context_id=context.get("id"),
                    )
        total_sentences += len(variants)

    if total_sentences != TARGET_SENTENCES:
        _issue(
            issues,
            "sentence_count",
            f"Beklenen {TARGET_SENTENCES}, bulunan {total_sentences} özgün+varyant cümle.",
        )

    counts = Counter(issue.severity for issue in issues)
    code_counts = Counter(issue.code for issue in issues)
    return {
        "schemaVersion": 1,
        "projectId": snapshot.get("project", {}).get("id"),
        "releaseReady": counts["error"] == 0,
        "metrics": {
            "mweCount": len(mwes),
            "contextCount": sum(len(item.get("contexts", [])) for item in mwes),
            "sentenceCount": total_sentences,
            "naturalContextCount": metrics["natural_contexts"],
            "externalContextCount": metrics["external_contexts"],
            "acceptedAnnotationCount": sum(accepted_counts.values()),
            "ordinaryControlApprovedCount": len(approved_controls),
            "errorCount": counts["error"],
            "warningCount": counts["warning"],
        },
        "gateCounts": dict(sorted(code_counts.items())),
        "issues": [asdict(issue) for issue in issues],
    }


def report_markdown(report: dict[str, Any], *, max_examples: int = 8) -> str:
    metrics = report["metrics"]
    lines = [
        "# NCIMP Research Studio - Veri Doğrulama Raporu",
        "",
        f"- **Yayın hazır:** {'Evet' if report['releaseReady'] else 'Hayır'}",
        f"- **MWE:** {metrics['mweCount']}/280",
        f"- **Bağlam:** {metrics['contextCount']}/1.400",
        f"- **Özgün + varyant cümle:** {metrics['sentenceCount']}/19.600",
        f"- **Kabul edilmiş anotasyon:** {metrics['acceptedAnnotationCount']}",
        f"- **Onaylı ordinary-control:** {metrics.get('ordinaryControlApprovedCount', 0)}/64",
        f"- **Engel:** {metrics['errorCount']}",
        "",
        "## Kapı bazında açık işler",
        "",
        "| Kapı | Açık kayıt |",
        "|---|---:|",
    ]
    lines.extend(f"| `{code}` | {count} |" for code, count in report["gateCounts"].items())
    lines.extend(["", "## Örnek sorunlar", ""])
    grouped: dict[str, list[dict]] = defaultdict(list)
    for issue in report["issues"]:
        grouped[issue["code"]].append(issue)
    for code, values in grouped.items():
        lines.append(f"### `{code}`")
        for item in values[:max_examples]:
            target = " / ".join(value for value in (item.get("mwe_id"), item.get("context_id")) if value)
            lines.append(f"- {target + ': ' if target else ''}{item['message']}")
        if len(values) > max_examples:
            lines.append(f"- … {len(values) - max_examples} kayıt daha")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
