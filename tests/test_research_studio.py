import json
import csv
from collections import Counter
from pathlib import Path

import pytest

from research_studio_worker.annotation import (
    aggregate_annotations,
    generate_assignments,
    select_stratified_pilot,
)
from research_studio_worker.validation import validate_snapshot
from research_studio_worker.export import canonical_instances, export_dataset
from research_studio_worker.jobs import JobRunner
from scripts.build_kenet_probe_candidates import component_query_forms


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def snapshot():
    return json.loads((ROOT / "studio/public/seed/tr_project.json").read_text(encoding="utf-8"))


def test_seed_is_structurally_paper_exact(snapshot):
    assert len(snapshot["mwes"]) == 280
    assert Counter(item["provisionalClass"] for item in snapshot["mwes"]) == {
        "I": 103,
        "PC": 88,
        "C": 89,
    }
    assert all([context["slot"] for context in item["contexts"]] == ["S1", "S2", "S3", "N1", "N2"] for item in snapshot["mwes"])
    assert all(context["span"] for item in snapshot["mwes"] for context in item["contexts"])
    assert all(len(item["probes"]) == 2 for item in snapshot["mwes"])
    assert all(len(item["variants"]) == 10 for item in snapshot["mwes"])


def test_release_validator_reports_real_remaining_work(snapshot):
    report = validate_snapshot(snapshot)
    assert report["releaseReady"] is False
    assert report["metrics"]["mweCount"] == 280
    assert report["metrics"]["contextCount"] == 1400
    assert report["metrics"]["sentenceCount"] == 4200
    assert report["gateCounts"]["gold_missing"] == 280
    assert report["gateCounts"]["external_example_gate"] == 145
    assert report["gateCounts"]["type_annotations"] == 280
    assert report["gateCounts"]["token_annotations"] == 840


def test_pilot_selection_is_balanced_and_reproducible(snapshot):
    selected = select_stratified_pilot(snapshot["mwes"])
    selected_again = select_stratified_pilot(snapshot["mwes"])
    assert selected == selected_again
    by_id = {item["id"]: item for item in snapshot["mwes"]}
    assert Counter(by_id[item]["provisionalClass"] for item in selected) == {"I": 10, "PC": 10, "C": 10}


def test_assignment_generation_requires_eight_unique_annotators(snapshot):
    pilot_ids = set(select_stratified_pilot(snapshot["mwes"][:]))
    pilot = [item for item in snapshot["mwes"] if item["id"] in pilot_ids]
    assignments, warnings = generate_assignments(
        pilot,
        [f"ann-{index:02d}" for index in range(8)],
        campaign_id="pilot-type",
        task_type="type",
    )
    assert len(assignments) == 30 * 8
    assert not warnings
    grouped = Counter((item["mweId"], item.get("contextId")) for item in assignments)
    assert set(grouped.values()) == {8}
    assert all(item["itemSnapshot"]["taskType"] == "type" for item in assignments)
    assert all(len(item["itemSnapshot"]["contexts"]) == 3 for item in assignments)
    assert all("provisionalClass" not in item["itemSnapshot"] for item in assignments)


def test_annotation_aggregation_keeps_immutable_assignment_join():
    assignments = [
        {
            "id": f"a-{index}",
            "mweId": "TR-NC-001",
            "contextId": None,
            "status": "accepted",
        }
        for index in range(8)
    ]
    annotations = [
        {
            "assignmentId": f"a-{index}",
            "overallScore": score,
            "modifierScore": score,
            "headScore": score,
            "confidence": 4,
            "paraphrase": "sert önlem",
        }
        for index, score in enumerate([0, 1, 1, 1, 1, 1, 2, 1])
    ]
    result = aggregate_annotations(annotations, assignments)
    assert result["items"][0]["n"] == 8
    assert result["items"][0]["mean"] == pytest.approx(1.0)
    assert result["items"][0]["requiresAdjudication"] is False


def test_canonical_draft_export_preserves_five_contexts(snapshot, tmp_path):
    instances = canonical_instances(snapshot)
    assert len(instances) == 280 * 5
    assert {item["sent_id"] for item in instances} == {"S1", "S2", "S3", "N1", "N2"}
    with pytest.raises(ValueError):
        export_dataset(snapshot, tmp_path / "blocked")
    manifest = export_dataset(snapshot, tmp_path / "draft", allow_draft=True)
    assert manifest["draft"] is True
    assert (tmp_path / "draft" / "TR.json").is_file()


def test_local_job_runner_validates_and_exports_inside_repo(snapshot):
    runner = JobRunner(ROOT)
    validation = runner.run({
        "type": "validate",
        "payload": {
            "snapshotPath": "studio/public/seed/tr_project.json",
            "outputDir": ".pytest_cache/studio-worker-test",
        },
    })
    assert validation.status == "succeeded"
    assert validation.summary["releaseReady"] is False
    with pytest.raises(ValueError):
        runner.run({"type": "shell", "payload": {"command": "echo unsafe"}})


def test_job_runner_rejects_paths_outside_repo():
    runner = JobRunner(ROOT)
    with pytest.raises(ValueError):
        runner.run({
            "type": "validate",
            "payload": {"snapshotPath": "/etc/passwd"},
        })


def test_draft_smoke_analysis_is_blocked_without_false_metrics():
    results_path = ROOT / "studio/public/artifacts/runs/tr-mock-smoke/results.csv"
    if not results_path.exists():
        pytest.skip("Mock worker run artifact has not been generated.")
    result = JobRunner(ROOT).run({
        "type": "analysis",
        "payload": {
            "resultsPath": str(results_path.relative_to(ROOT)),
            "outputDir": "studio/public/artifacts/runs/tr-mock-smoke",
            "level": "nc",
        },
    })
    assert result.status == "succeeded"
    assert result.summary["analysisReady"] is False
    assert result.summary["goldResultRows"] == 0


def test_turkish_compound_head_fallbacks_are_explicit():
    assert ("hafıza", "strip_buffer_s_possessive") in component_query_forms("hafızası", "head")
    assert ("ocak", "strip_possessive_reverse_softening") in component_query_forms("ocağı", "head")
    assert ("kurt", "strip_plural") in component_query_forms("kurtlar", "modifier")
    assert component_query_forms("hava", "modifier") == [("hava", "exact")]


def test_kenet_candidates_are_evidence_backed_and_never_auto_approved():
    path = ROOT / "studio/public/candidates/kenet_probe_candidates.json"
    artifact = json.loads(path.read_text(encoding="utf-8"))
    assert artifact["source"]["snapshotSha256"] == "4023b4f815dcae78171c69d26e6f31aae3ba70c98fb2e44919a09e87d673d66c"
    assert artifact["policy"]["autoApproval"] is False
    assert artifact["summary"]["mweCount"] == 280
    assert artifact["summary"]["fullMweExactMatchCount"] == 151
    assert artifact["summary"]["mwesWithPSynCandidate"] == 46
    assert artifact["summary"]["mwesWithPWordsSynCandidate"] == 220
    candidates = [candidate for item in artifact["items"] for candidate in item["candidates"]]
    assert candidates
    assert {candidate["kind"] for candidate in candidates} == {"P_Syn", "P_WordsSyn"}
    assert all(candidate["reviewStatus"] == "review_required" for candidate in candidates)
    assert all(candidate["licenseReviewStatus"] == "content_license_review_required" for candidate in candidates)


def test_tatoeba_review_pool_preserves_selection_and_provenance():
    path = ROOT / "studio/public/candidates/tatoeba_example_candidates.json"
    artifact = json.loads(path.read_text(encoding="utf-8"))
    assert artifact["policy"]["autoApproval"] is False
    assert artifact["summary"]["candidateCount"] == 2084
    assert artifact["summary"]["alreadySelectedCount"] == 249
    assert artifact["summary"]["newReviewCandidateCount"] == 1835
    assert artifact["summary"]["mwesWithAnyMatch"] == 165
    new_candidates = [
        item for item in artifact["candidates"]
        if item["datasetStatus"] == "candidate"
    ]
    assert all(item["reviewStatus"] == "review_required" for item in new_candidates)
    assert all(item["sourceId"] == "SRC-002" for item in artifact["candidates"])
    assert all(item["sourceRecordId"].isdigit() for item in artifact["candidates"])


def test_random_probe_pool_implements_frequency_matching_without_auto_approval():
    artifact = json.loads(
        (ROOT / "studio/public/candidates/tatoeba_random_probe_candidates.json")
        .read_text(encoding="utf-8")
    )
    assert artifact["method"]["formula"] == "favg=(fNC+fw1+fw2)/3"
    assert artifact["method"]["autoApproval"] is False
    assert artifact["summary"]["mweCount"] == 280
    assert artifact["summary"]["candidateCount"] == 2800
    assert artifact["summary"]["mwesWithFiveOrMoreCandidates"] == 280
    for item in artifact["items"]:
        assert len(item["candidates"]) == 10
        assert all(candidate["reviewStatus"] == "review_required" for candidate in item["candidates"])
        assert all(candidate["componentOverlap"] is False for candidate in item["candidates"])


def test_article_aligned_results_include_fourth_experiment_and_no_mock_rows():
    artifact = json.loads(
        (ROOT / "studio/public/results/run_indicators.json").read_text(encoding="utf-8")
    )
    assert artifact["schemaVersion"] == 2
    assert artifact["protocolVersion"] == "ncimp-ordinary-calibrated-v2"
    assert artifact["primaryAnalysisLevel"] == "contextual_span"
    assert artifact["studyModelCount"] == 20
    assert len(artifact["calibration"]) == 20
    assert {row["studyExperiment"] for row in artifact["diagnostics"]} == {1, 2, 3}
    assert all(row["model"] != "mock" for row in artifact["indicators"])
    assert max(row["ocgIdiom"] for row in artifact["calibration"] if row["ocgIdiom"] is not None) < 1


def test_en_pt_reference_artifacts_are_read_only_and_preserve_known_anomaly():
    index = json.loads(
        (ROOT / "studio/public/references/ncimp_en_pt_reference.json").read_text(encoding="utf-8")
    )
    assert index["readOnly"] is True
    assert index["summary"]["EN"]["officialPaperMweCount"] == 280
    assert index["summary"]["EN"]["rawSnapshotMweCount"] == 281
    assert index["summary"]["EN"]["scoredMweCount"] == 279
    assert index["summary"]["PT"]["rawSnapshotMweCount"] == 180
    for language, expected in (("en", 281), ("pt", 180)):
        artifact = json.loads(
            (ROOT / f"studio/public/references/ncimp_{language}_reference.json")
            .read_text(encoding="utf-8")
        )
        assert len(artifact["items"]) == expected
        assert all([context["slot"] for context in item["contexts"]] == ["S1", "S2", "S3", "N1", "N2"] for item in artifact["items"])
        assert all(context["probes"]["P_Syn"] for item in artifact["items"] for context in item["contexts"])


def test_turkish_ordinary_control_is_balanced_and_explicitly_not_gold():
    with (ROOT / "data/ncimp/TR/turkish_ordinary_control.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 64
    assert Counter(row["group"] for row in rows) == {
        "idiomatic_nc": 16,
        "compositional_nc": 16,
        "single_word_control": 16,
        "ordinary_two_word_control": 16,
    }
    assert all(row["original"].count(row["target"]) == 1 for row in rows)
    assert all(row["synonym"] and row["random"] for row in rows)
    assert all(row["frequency_match_status"] == "pending_corpus_validation" for row in rows)
    assert all(row["review_status"] == "review_required" for row in rows)
