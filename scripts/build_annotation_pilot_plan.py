#!/usr/bin/env python3
"""Freeze the balanced 30-MWE type/token pilot item snapshots."""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from research_studio_worker.annotation import select_stratified_pilot


SEED = ROOT / "studio/public/seed/tr_project.json"
OUTPUT = ROOT / "studio/public/annotation/tr_pilot_plan.json"


def digest(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def context_snapshot(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": context["id"],
        "slot": context["slot"],
        "sentence": context["sentence"],
        "targetSurface": context["targetSurface"],
        "span": context["span"],
    }


def item_snapshot(mwe: dict[str, Any], task_type: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    natural = [item for item in mwe["contexts"] if item["slot"] in {"S1", "S2", "S3"}]
    contexts = [context] if context else natural
    return {
        "taskType": task_type,
        "mweId": mwe["id"],
        "canonicalForm": mwe["canonicalForm"],
        "modifier": mwe["modifier"],
        "head": mwe["head"],
        "meaning": mwe["meaning"],
        "contexts": [context_snapshot(item) for item in contexts],
    }


def main() -> None:
    snapshot = json.loads(SEED.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in snapshot["mwes"]}
    selected_ids = select_stratified_pilot(snapshot["mwes"])
    type_items: list[dict[str, Any]] = []
    token_items: list[dict[str, Any]] = []
    for mwe_id in selected_ids:
        mwe = by_id[mwe_id]
        frozen = item_snapshot(mwe, "type")
        type_items.append({
            "id": f"{mwe_id}-TYPE",
            "mweId": mwe_id,
            "contextId": None,
            "itemSnapshotHash": digest(frozen),
            "itemSnapshot": frozen,
        })
        for context in mwe["contexts"]:
            if context["slot"] not in {"S1", "S2", "S3"}:
                continue
            frozen = item_snapshot(mwe, "token", context)
            token_items.append({
                "id": context["id"],
                "mweId": mwe_id,
                "contextId": context["id"],
                "itemSnapshotHash": digest(frozen),
                "itemSnapshot": frozen,
            })
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(UTC).isoformat(),
        "projectId": "tr-ncimp",
        "selection": {
            "seed": 20260623,
            "perClass": 10,
            "selectedMweIds": selected_ids,
            "warning": "Provisional classes are used only for balanced pilot sampling and are hidden from annotators.",
        },
        "campaigns": {
            "type": {"id": "tr-type-pilot-v1", "targetAnnotators": 8, "items": type_items},
            "token": {"id": "tr-token-pilot-v1", "targetAnnotators": 8, "items": token_items},
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(type_items)} type, {len(token_items)} token items")


if __name__ == "__main__":
    main()
