"""Safe local job dispatcher for validation, export and experiment runs."""

from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import yaml

from .annotation import aggregate_annotations
from .export import export_dataset
from .validation import report_markdown, validate_snapshot


ProgressCallback = Callable[[int, str], None]
CancelCallback = Callable[[], bool]


@dataclass(frozen=True)
class JobResult:
    status: str
    summary: dict[str, Any]
    artifacts: list[str]


class JobRunner:
    ALLOWED_TYPES = {"validate", "export", "aggregate", "experiment", "analysis"}

    def __init__(self, root: Path):
        self.root = root.resolve()

    def _within_root(self, value: str | Path) -> Path:
        path = Path(value)
        if not path.is_absolute():
            path = self.root / path
        path = path.resolve()
        if path != self.root and self.root not in path.parents:
            raise ValueError(f"Repo dışındaki yola erişim reddedildi: {path}")
        return path

    def _load_snapshot(self, payload: dict[str, Any]) -> dict[str, Any]:
        path = self._within_root(
            payload.get("snapshotPath", "studio/public/seed/tr_project.json")
        )
        return json.loads(path.read_text(encoding="utf-8"))

    def run(
        self,
        job: dict[str, Any],
        *,
        progress: ProgressCallback | None = None,
        cancelled: CancelCallback | None = None,
    ) -> JobResult:
        job_type = job.get("type")
        if job_type not in self.ALLOWED_TYPES:
            raise ValueError(f"İzin verilmeyen iş türü: {job_type}")
        progress = progress or (lambda _percent, _message: None)
        cancelled = cancelled or (lambda: False)
        if cancelled():
            return JobResult("cancelled", {"message": "İş başlamadan iptal edildi."}, [])
        handler = getattr(self, f"_run_{job_type}")
        return handler(job.get("payload") or {}, progress, cancelled)

    def _run_validate(
        self,
        payload: dict[str, Any],
        progress: ProgressCallback,
        _cancelled: CancelCallback,
    ) -> JobResult:
        progress(15, "Snapshot yükleniyor")
        snapshot = self._load_snapshot(payload)
        report = validate_snapshot(snapshot)
        output_dir = self._within_root(
            payload.get("outputDir", "studio/public/reports")
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        json_path = output_dir / "tr_validation.json"
        md_path = output_dir / "tr_validation.md"
        json_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        md_path.write_text(report_markdown(report), encoding="utf-8")
        progress(100, "Doğrulama tamamlandı")
        return JobResult(
            "succeeded",
            {"releaseReady": report["releaseReady"], **report["metrics"]},
            [str(json_path.relative_to(self.root)), str(md_path.relative_to(self.root))],
        )

    def _run_export(
        self,
        payload: dict[str, Any],
        progress: ProgressCallback,
        _cancelled: CancelCallback,
    ) -> JobResult:
        snapshot = self._load_snapshot(payload)
        version = str(payload.get("version", "draft-current"))
        if not version.replace("-", "").replace(".", "").isalnum():
            raise ValueError("Geçersiz veri sürümü.")
        output_dir = self._within_root(
            payload.get(
                "outputDir",
                f"studio/public/artifacts/datasets/{version}",
            )
        )
        progress(20, "Yayın kapıları denetleniyor")
        manifest = export_dataset(
            snapshot,
            output_dir,
            allow_draft=bool(payload.get("allowDraft", False)),
        )
        progress(100, "Veri paketi üretildi")
        artifacts = [
            str(path.relative_to(self.root))
            for path in sorted(output_dir.iterdir())
            if path.is_file()
        ]
        return JobResult("succeeded", manifest, artifacts)

    def _allowed_models(self) -> set[str]:
        registry = yaml.safe_load((self.root / "models.yaml").read_text(encoding="utf-8"))
        return {item["name"] for item in registry.get("models", [])}

    def _run_aggregate(
        self,
        payload: dict[str, Any],
        progress: ProgressCallback,
        _cancelled: CancelCallback,
    ) -> JobResult:
        progress(15, "Kabul edilmiş anotasyonlar yükleniyor")
        snapshot = self._load_snapshot(payload)
        result = aggregate_annotations(
            snapshot.get("annotations", []),
            snapshot.get("assignments", []),
        )
        output_dir = self._within_root(
            payload.get("outputDir", "runs/research-studio-worker/aggregation")
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "tr_annotation_aggregates.json"
        output_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        progress(100, "Anotasyon agregasyonu tamamlandı")
        return JobResult(
            "succeeded",
            {
                "itemCount": len(result["items"]),
                "requiresAdjudicationCount": sum(
                    item["requiresAdjudication"] for item in result["items"]
                ),
                **result["agreement"],
            },
            [str(output_path.relative_to(self.root))],
        )

    def _run_experiment(
        self,
        payload: dict[str, Any],
        progress: ProgressCallback,
        cancelled: CancelCallback,
    ) -> JobResult:
        models = [str(value) for value in payload.get("models", [])]
        if not models or not set(models).issubset(self._allowed_models()):
            raise ValueError("Model listesi boş veya models.yaml dışında model içeriyor.")
        contexts = payload.get("contexts", ["naturalistic", "neutral"])
        levels = payload.get("levels", ["nc", "sentence"])
        if not set(contexts).issubset({"naturalistic", "neutral"}):
            raise ValueError("Geçersiz bağlam seçimi.")
        if not set(levels).issubset({"nc", "sentence"}):
            raise ValueError("Geçersiz embedding seviyesi.")
        data_dir = self._within_root(payload["dataDir"])
        run_id = str(payload.get("runId", f"tr-{int(time.time())}"))
        if not run_id.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Geçersiz runId.")
        output_dir = self._within_root(payload.get("outputDir", f"runs/studio/{run_id}"))
        output_dir.mkdir(parents=True, exist_ok=True)
        log_path = output_dir / "worker.log"
        command = [
            sys.executable,
            str(self.root / "scripts/run_experiment.py"),
            "--models",
            str(self.root / "models.yaml"),
            "--select",
            *models,
            "--data",
            str(data_dir),
            "--lang",
            "TR",
            "--context",
            *contexts,
            "--level",
            *levels,
            "--out",
            str(output_dir),
            "--seed",
            str(int(payload.get("seed", 0))),
        ]
        device = payload.get("device")
        if device:
            if device not in {"cpu", "mps", "cuda"}:
                raise ValueError("Geçersiz cihaz.")
            command.extend(["--device", device])
        limit = payload.get("limit")
        if limit is not None:
            command.extend(["--limit", str(int(limit))])

        progress(5, "Model süreci başlatılıyor")
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                command,
                cwd=self.root,
                stdout=log,
                stderr=subprocess.STDOUT,
                text=True,
                env=os.environ.copy(),
            )
            while process.poll() is None:
                if cancelled():
                    process.terminate()
                    try:
                        process.wait(timeout=20)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    progress(100, "İş iptal edildi")
                    return JobResult(
                        "cancelled",
                        {"runId": run_id, "message": "Kullanıcı iptali"},
                        [str(log_path.relative_to(self.root))],
                    )
                progress(10, "Model çalışıyor")
                time.sleep(2)
        if process.returncode != 0:
            tail = log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-30:]
            raise RuntimeError("Model işi başarısız:\n" + "\n".join(tail))
        progress(85, "Sonuçlar analiz ediliyor")
        results_path = output_dir / "results.csv"
        summary_path = output_dir / "summary.json"
        row_count = 0
        if results_path.exists():
            with results_path.open(encoding="utf-8", newline="") as handle:
                row_count = sum(1 for _ in csv.DictReader(handle))
        progress(100, "Deney tamamlandı")
        artifacts = [
            str(path.relative_to(self.root))
            for path in (results_path, summary_path, log_path)
            if path.exists()
        ]
        return JobResult(
            "succeeded",
            {"runId": run_id, "models": models, "resultRows": row_count},
            artifacts,
        )

    def _run_analysis(
        self,
        payload: dict[str, Any],
        progress: ProgressCallback,
        _cancelled: CancelCallback,
    ) -> JobResult:
        results_path = self._within_root(payload["resultsPath"])
        output_dir = self._within_root(payload.get("outputDir", str(results_path.parent)))
        level = payload.get("level", "nc")
        if level not in {"nc", "sentence"}:
            raise ValueError("Geçersiz analiz seviyesi.")
        required_measurements = {
            "sim_P_Syn",
            "sim_P_Comp",
            "sim_P_WordsSyn",
            "sim_P_Rand",
            "aff_Syn|WordsSyn",
            "simR_Syn",
        }
        with results_path.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        measurements = {row.get("measurement", "") for row in rows}
        gold_count = sum(bool(row.get("comp_score", "").strip()) for row in rows)
        missing = sorted(required_measurements - measurements)
        if missing or gold_count == 0:
            output_dir.mkdir(parents=True, exist_ok=True)
            blocked_path = output_dir / "ANALYSIS_BLOCKED.md"
            reasons = []
            if missing:
                reasons.append("Eksik ölçümler: " + ", ".join(f"`{value}`" for value in missing))
            if gold_count == 0:
                reasons.append("Gold kompozisyonellik skoru bulunan sonuç satırı yok.")
            blocked_path.write_text(
                "# Analiz henüz çalıştırılamaz\n\n"
                "Bu koşu teknik smoke test olarak tamamlandı; bilimsel NCIMP analizi için "
                "gerekli veri kapıları henüz kapanmadı.\n\n"
                + "\n".join(f"- {reason}" for reason in reasons)
                + "\n",
                encoding="utf-8",
            )
            progress(100, "Analiz önkoşulları raporlandı")
            return JobResult(
                "succeeded",
                {"analysisReady": False, "missingMeasurements": missing, "goldResultRows": gold_count},
                [str(blocked_path.relative_to(self.root))],
            )
        command = [
            sys.executable,
            str(self.root / "scripts/analyze.py"),
            "--results",
            str(results_path),
            "--out",
            str(output_dir),
            "--level",
            level,
            "--lang",
            "TR",
        ]
        progress(20, "Analiz başlatılıyor")
        completed = subprocess.run(
            command,
            cwd=self.root,
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr or completed.stdout)
        progress(100, "Analiz tamamlandı")
        artifacts = [
            str(path.relative_to(self.root))
            for path in (output_dir / "indicators.csv", output_dir / "REPORT.md")
            if path.exists()
        ]
        return JobResult("succeeded", {"level": level}, artifacts)
