"""Firestore queue adapter for the native local worker."""

from __future__ import annotations

import os
import json
import socket
import time
import traceback
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from .jobs import JobRunner


def _now() -> str:
    return datetime.now(UTC).isoformat()


class FirestoreWorker:
    def __init__(self, root: Path, *, project_id: str, poll_seconds: float = 3.0):
        self.root = root.resolve()
        self.project_id = project_id
        self.poll_seconds = poll_seconds
        self.worker_id = f"{socket.gethostname()}-{os.getpid()}"
        if not firebase_admin._apps:
            service_account = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            credential = credentials.Certificate(service_account) if service_account else credentials.ApplicationDefault()
            firebase_admin.initialize_app(credential, {"projectId": project_id})
        self.db = firestore.client()
        self.runner = JobRunner(self.root)

    @staticmethod
    def _json_safe(value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: FirestoreWorker._json_safe(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [FirestoreWorker._json_safe(item) for item in value]
        return value

    def _collection_rows(self, name: str) -> list[dict[str, Any]]:
        return [
            self._json_safe({"id": snapshot.id, **(snapshot.to_dict() or {})})
            for snapshot in self.db.collection(name).stream()
        ]

    def _materialize_snapshot(self, job: dict[str, Any]) -> dict[str, Any]:
        """Replace snapshotSource=firestore with a frozen local job snapshot."""
        payload = dict(job.get("payload") or {})
        if payload.get("snapshotSource") != "firestore":
            return job
        project_id = str(payload.get("projectId", "tr-ncimp"))
        project_ref = self.db.collection("projects").document(project_id)
        project_doc = project_ref.get()
        if not project_doc.exists:
            raise ValueError(f"Firestore projesi bulunamadı: {project_id}")
        project = self._json_safe({"id": project_id, **(project_doc.to_dict() or {})})
        snapshot = {
            "schemaVersion": int(project.get("schemaVersion", 1)),
            "generatedAt": _now(),
            "project": project,
            "mwes": [
                self._json_safe({"id": item.id, **(item.to_dict() or {})})
                for item in project_ref.collection("mwes").stream()
            ],
            "sources": self._collection_rows("sources"),
            "campaigns": self._collection_rows("campaigns"),
            "assignments": self._collection_rows("assignments"),
            "annotations": self._collection_rows("annotations"),
            "ordinaryControlReviews": self._collection_rows("ordinaryControlReviews"),
            "jobs": self._collection_rows("jobs"),
            "runs": self._collection_rows("runs"),
        }
        snapshot_dir = self.root / "runs" / "research-studio-worker" / "snapshots"
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        snapshot_path = snapshot_dir / f"{job['id']}.json"
        snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        payload["snapshotPath"] = str(snapshot_path.relative_to(self.root))
        return {**job, "payload": payload}

    def _publish_result(self, job: dict[str, Any], result) -> None:
        payload = job.get("payload") or {}
        project_id = str(payload.get("projectId", "tr-ncimp"))
        if job.get("type") == "validate" and result.status == "succeeded":
            json_artifact = next((value for value in result.artifacts if value.endswith("tr_validation.json")), None)
            if json_artifact:
                report = json.loads((self.root / json_artifact).read_text(encoding="utf-8"))
                full_issue_count = len(report.get("issues", []))
                report["issues"] = report.get("issues", [])[:100]
                report.update({
                    "jobId": job["id"],
                    "generatedAt": _now(),
                    "fullIssueCount": full_issue_count,
                    "issuesTruncated": full_issue_count > len(report["issues"]),
                    "artifacts": result.artifacts,
                })
                self.db.collection("validationReports").document(project_id).set(report)
        if job.get("type") == "export" and result.status == "succeeded":
            version = str(payload.get("version", "draft-current"))
            self.db.collection("datasetVersions").document(version).set(
                {
                    **result.summary,
                    "id": version,
                    "projectId": project_id,
                    "status": "draft" if result.summary.get("draft", True) else "released",
                    "jobId": job["id"],
                    "artifacts": result.artifacts,
                    "createdAt": firestore.SERVER_TIMESTAMP,
                }
            )
        if job.get("type") == "aggregate" and result.status == "succeeded":
            aggregate_artifact = next(
                (value for value in result.artifacts if value.endswith("tr_annotation_aggregates.json")),
                None,
            )
            if aggregate_artifact:
                aggregated = json.loads((self.root / aggregate_artifact).read_text(encoding="utf-8"))
                generated_at = _now()
                batch = self.db.batch()
                batch_size = 0
                for item in aggregated.get("items", []):
                    aggregate_id = f"{item['mweId']}--{item.get('contextId') or 'TYPE'}"
                    ref = self.db.collection("annotationAggregates").document(aggregate_id)
                    batch.set(
                        ref,
                        {
                            "id": aggregate_id,
                            "projectId": project_id,
                            "jobId": job["id"],
                            "generatedAt": generated_at,
                            **item,
                        },
                    )
                    batch_size += 1
                    if batch_size == 400:
                        batch.commit()
                        batch = self.db.batch()
                        batch_size = 0
                if batch_size:
                    batch.commit()
                self.db.collection("aggregationReports").document(project_id).set(
                    {
                        "projectId": project_id,
                        "jobId": job["id"],
                        "generatedAt": generated_at,
                        **result.summary,
                    }
                )

    def heartbeat(self, status: str, job_id: str | None = None) -> None:
        self.db.collection("workerHeartbeats").document(self.worker_id).set(
            {
                "workerId": self.worker_id,
                "status": status,
                "jobId": job_id,
                "hostname": socket.gethostname(),
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "schemaVersion": 1,
            },
            merge=True,
        )

    def _claim(self, job_ref) -> dict[str, Any] | None:
        transaction = self.db.transaction()

        @firestore.transactional
        def claim_in_transaction(txn):
            snapshot = job_ref.get(transaction=txn)
            data = snapshot.to_dict() or {}
            if data.get("status") != "queued":
                return None
            txn.update(
                job_ref,
                {
                    "status": "running",
                    "workerId": self.worker_id,
                    "startedAt": firestore.SERVER_TIMESTAMP,
                    "progress": 1,
                    "message": "Yerel worker işi sahiplendi.",
                },
            )
            return {"id": snapshot.id, **data}

        return claim_in_transaction(transaction)

    def _cancel_requested(self, job_id: str) -> bool:
        data = self.db.collection("jobs").document(job_id).get().to_dict() or {}
        return bool(data.get("cancelRequested"))

    def _progress(self, job_id: str, percent: int, message: str) -> None:
        self.db.collection("jobs").document(job_id).update(
            {"progress": percent, "message": message, "updatedAt": firestore.SERVER_TIMESTAMP}
        )

    def process_one(self) -> bool:
        query = (
            self.db.collection("jobs")
            .where(filter=FieldFilter("status", "==", "queued"))
            .limit(10)
        )
        for candidate in query.stream():
            job = self._claim(candidate.reference)
            if not job:
                continue
            job_id = job["id"]
            self.heartbeat("running", job_id)
            try:
                runnable_job = self._materialize_snapshot(job)
                result = self.runner.run(
                    runnable_job,
                    progress=lambda percent, message: self._progress(job_id, percent, message),
                    cancelled=lambda: self._cancel_requested(job_id),
                )
                candidate.reference.update(
                    {
                        "status": result.status,
                        "progress": 100,
                        "result": result.summary,
                        "artifacts": result.artifacts,
                        "finishedAt": firestore.SERVER_TIMESTAMP,
                    }
                )
                self._publish_result(runnable_job, result)
            except Exception as exc:
                candidate.reference.update(
                    {
                        "status": "failed",
                        "error": str(exc),
                        "traceback": traceback.format_exc(limit=12),
                        "finishedAt": firestore.SERVER_TIMESTAMP,
                    }
                )
            finally:
                self.heartbeat("idle")
            return True
        self.heartbeat("idle")
        return False

    def run_forever(self) -> None:
        self.heartbeat("idle")
        while True:
            processed = self.process_one()
            if not processed:
                time.sleep(self.poll_seconds)
