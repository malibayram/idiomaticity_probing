"""Export a release-ready Research Studio snapshot to canonical NCIMP JSON."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .validation import validate_snapshot


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_instances(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    instances: list[dict[str, Any]] = []
    for mwe in snapshot["mwes"]:
        variants_by_context: dict[str, list[dict[str, Any]]] = {}
        for variant in mwe.get("variants", []):
            variants_by_context.setdefault(variant["contextId"], []).append(variant)
        for context in mwe["contexts"]:
            probes: dict[str, list[dict[str, Any]]] = {}
            for variant in variants_by_context.get(context["id"], []):
                probes.setdefault(variant["probeKind"], []).append(
                    {"sentence": variant["sentence"], "span": variant["span"]}
                )
            instances.append(
                {
                    "nc": mwe["canonicalForm"],
                    "lang": mwe["language"],
                    "context": context["family"],
                    "comp_class": mwe.get("goldClass") or mwe["provisionalClass"],
                    "comp_score": mwe.get("goldScore"),
                    "sent_id": context["slot"],
                    "original": {"sentence": context["sentence"], "span": context["span"]},
                    "probes": probes,
                }
            )
    return instances


def export_dataset(
    snapshot: dict[str, Any],
    output_dir: Path,
    *,
    allow_draft: bool = False,
) -> dict[str, Any]:
    report = validate_snapshot(snapshot)
    if not report["releaseReady"] and not allow_draft:
        raise ValueError(
            f"Veri yayın kapılarını geçmedi: {report['metrics']['errorCount']} açık engel."
        )
    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_path = output_dir / "TR.json"
    dataset_path.write_text(
        json.dumps(canonical_instances(snapshot), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    validation_path = output_dir / "validation.json"
    validation_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    manifest = {
        "schemaVersion": 1,
        "projectId": snapshot["project"]["id"],
        "protocolVersion": snapshot["project"]["protocolVersion"],
        "createdAt": datetime.now(UTC).isoformat(),
        "draft": not report["releaseReady"],
        "files": {
            dataset_path.name: {"sha256": _sha256(dataset_path), "bytes": dataset_path.stat().st_size},
            validation_path.name: {"sha256": _sha256(validation_path), "bytes": validation_path.stat().st_size},
        },
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest
