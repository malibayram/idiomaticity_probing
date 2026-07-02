import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  annotationPilotPlanSchema,
  exampleCandidateArtifactSchema,
  kenetCandidateArtifactSchema,
  randomProbeCandidateArtifactSchema,
  referenceDatasetIndexSchema,
  referenceDatasetLanguageSchema,
  ordinaryControlArtifactSchema,
  researchSnapshotSchema,
} from "../src/data/schema";
import {
  applyApprovedProbeCandidate,
  replaceTokenSpan,
} from "../src/data/probe-transform";
import {
  applyApprovedExampleCandidate,
  locateTokenSpan,
} from "../src/data/context-transform";
import { buildPilotAssignments, buildPreAnnotationAssignments } from "../src/data/assignment-plan";
import { aggregateAcceptedAnnotations } from "../src/data/annotation-aggregation";


function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

describe("bundled research artifacts", () => {
  test("TR seed satisfies the browser contract", () => {
    const snapshot = researchSnapshotSchema.parse(readJson("public/seed/tr_project.json"));
    expect(snapshot.mwes).toHaveLength(280);
    expect(snapshot.mwes.flatMap((item) => item.contexts)).toHaveLength(1_400);
    expect(snapshot.mwes.every((item) => item.contexts.every((context) => context.span))).toBe(true);
    expect(snapshot.project.protocolVersion).toBe("ncimp-ordinary-calibrated-v2");
  });

  test("EN/PT read-only references expose five contexts and raw-score anomalies", () => {
    const index = referenceDatasetIndexSchema.parse(readJson("public/references/ncimp_en_pt_reference.json"));
    const en = referenceDatasetLanguageSchema.parse(readJson("public/references/ncimp_en_reference.json"));
    const pt = referenceDatasetLanguageSchema.parse(readJson("public/references/ncimp_pt_reference.json"));
    expect(index.summary.EN.rawSnapshotMweCount).toBe(281);
    expect(index.summary.EN.scoredMweCount).toBe(279);
    expect(en.items).toHaveLength(281);
    expect(pt.items).toHaveLength(180);
    expect([...en.items, ...pt.items].every((item) => item.contexts.length === 5)).toBe(true);
  });

  test("TR ordinary control mirrors the four balanced Experiment 4 groups", () => {
    const artifact = ordinaryControlArtifactSchema.parse(readJson("public/controls/turkish_ordinary_control.json"));
    expect(artifact.items).toHaveLength(64);
    expect(Object.values(artifact.summary.groupCounts)).toEqual([16, 16, 16, 16]);
    expect(artifact.items.every((item) => item.review_status === "review_required")).toBe(true);
  });

  test("KeNet artifact is valid and review-only", () => {
    const artifact = kenetCandidateArtifactSchema.parse(
      readJson("public/candidates/kenet_probe_candidates.json"),
    );
    expect(artifact.items).toHaveLength(280);
    expect(artifact.summary.mwesWithPSynCandidate).toBe(46);
    expect(artifact.summary.mwesWithPWordsSynCandidate).toBe(220);
    expect(artifact.items.flatMap((item) => item.candidates).every(
      (candidate) => candidate.reviewStatus === "review_required",
    )).toBe(true);
  });

  test("Tatoeba artifact links selected examples and keeps new matches review-only", () => {
    const artifact = exampleCandidateArtifactSchema.parse(
      readJson("public/candidates/tatoeba_example_candidates.json"),
    );
    expect(artifact.summary.candidateCount).toBe(2_084);
    expect(artifact.summary.alreadySelectedCount).toBe(249);
    expect(artifact.summary.newReviewCandidateCount).toBe(1_835);
    expect(artifact.candidates.filter((item) => item.datasetStatus === "candidate").every(
      (item) => item.reviewStatus === "review_required",
    )).toBe(true);
  });

  test("P_Rand pool follows the paper frequency formula and remains review-only", () => {
    const artifact = randomProbeCandidateArtifactSchema.parse(
      readJson("public/candidates/tatoeba_random_probe_candidates.json"),
    );
    expect(artifact.method.formula).toBe("favg=(fNC+fw1+fw2)/3");
    expect(artifact.summary.mweCount).toBe(280);
    expect(artifact.summary.candidateCount).toBe(2_800);
    expect(artifact.items.every((item) => item.candidates.length === 10)).toBe(true);
    expect(artifact.items.flatMap((item) => item.candidates).every(
      (candidate) => candidate.reviewStatus === "review_required" && !candidate.componentOverlap,
    )).toBe(true);
  });
});

describe("example approval transformation", () => {
  test("finds inflected target surface spans", () => {
    expect(locateTokenSpan("Kurul acı reçeteyi bugün açıkladı.", "acı reçeteyi")).toEqual([1, 3]);
  });

  test("replaces one context and regenerates only its review-required variants", () => {
    const snapshot = researchSnapshotSchema.parse(readJson("public/seed/tr_project.json"));
    const artifact = exampleCandidateArtifactSchema.parse(
      readJson("public/candidates/tatoeba_example_candidates.json"),
    );
    const candidate = artifact.candidates.find((item) => item.datasetStatus === "candidate");
    expect(candidate).toBeDefined();
    const record = snapshot.mwes.find((item) => item.id === candidate!.mweId);
    expect(record).toBeDefined();
    const beforeOtherContexts = record!.variants.filter((variant) => variant.contextId !== `${record!.id}-S1`);
    const transformed = applyApprovedExampleCandidate(record!, candidate!, "S1");
    const context = transformed.contexts.find((item) => item.slot === "S1");
    expect(context?.sentence).toBe(candidate!.sentence);
    expect(context?.provenance.sourceId).toBe("SRC-002");
    expect(context?.reviewStatus).toBe("approved");
    expect(transformed.variants.filter((variant) => variant.contextId === `${record!.id}-S1`)).toHaveLength(record!.probes.length);
    expect(transformed.variants.filter((variant) => variant.contextId !== `${record!.id}-S1`)).toEqual(beforeOtherContexts);
  });
});

describe("frozen annotation pilot", () => {
  test("creates balanced stable assignments without leaking class labels", () => {
    const plan = annotationPilotPlanSchema.parse(readJson("public/annotation/tr_pilot_plan.json"));
    expect(plan.campaigns.type.items).toHaveLength(30);
    expect(plan.campaigns.token.items).toHaveLength(90);
    const annotators = Array.from({ length: 2 }, (_, index) => `ann-${index}`);
    const typeAssignments = buildPilotAssignments(plan, "type", annotators);
    const tokenAssignments = buildPilotAssignments(plan, "token", annotators);
    expect(typeAssignments).toHaveLength(60);
    expect(tokenAssignments).toHaveLength(180);
    expect(new Set(typeAssignments.map((item) => item.id)).size).toBe(60);
    expect(typeAssignments.every((item) => !("provisionalClass" in item.itemSnapshot))).toBe(true);
    expect(typeAssignments.every((item) => item.itemSnapshot.contexts.length === 3)).toBe(true);
    expect(tokenAssignments.every((item) => item.itemSnapshot.contexts.length === 1)).toBe(true);
  });

  test("single-curator prelabels stay in a separate non-gold campaign namespace", () => {
    const plan = annotationPilotPlanSchema.parse(readJson("public/annotation/tr_pilot_plan.json"));
    const assignments = buildPreAnnotationAssignments(plan, "type", "curator-1");
    expect(assignments).toHaveLength(30);
    expect(assignments.every((item) => item.campaignId === "tr-prelabel-type-v1")).toBe(true);
    expect(assignments.every((item) => item.assigneeId === "curator-1")).toBe(true);
  });

  test("browser aggregation uses only accepted immutable assignment joins", () => {
    const plan = annotationPilotPlanSchema.parse(readJson("public/annotation/tr_pilot_plan.json"));
    const assignments = buildPilotAssignments(plan, "type", Array.from({ length: 2 }, (_, index) => `ann-${index}`))
      .slice(0, 2)
      .map((assignment) => ({ ...assignment, status: "accepted" as const }));
    const annotations = assignments.map((assignment, index) => ({
      id: assignment.id, assignmentId: assignment.id, campaignId: assignment.campaignId,
      annotatorId: assignment.assigneeId, mweId: assignment.mweId, contextId: null,
      overallScore: index === 0 ? 0 : 1, modifierScore: 1, headScore: 1,
      confidence: 4, paraphrase: "anlam", comment: "", submittedAt: "2026-06-23T00:00:00Z",
    }));
    const result = aggregateAcceptedAnnotations(annotations, assignments);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].n).toBe(2);
    expect(result.items[0].mean).toBeCloseTo(0.5);
    expect(result.items[0].requiresAdjudication).toBe(false);
  });
});

describe("probe approval transformation", () => {
  test("preserves punctuation and returns an exact replacement span", () => {
    expect(replaceTokenSpan("Bu, bir acı reçetedir.", [2, 4], "sert önlem")).toEqual({
      sentence: "Bu, bir sert önlem.",
      targetSurface: "sert önlem",
      span: [2, 4],
    });
  });

  test("adds one approved probe and five review-required variants", () => {
    const snapshot = researchSnapshotSchema.parse(readJson("public/seed/tr_project.json"));
    const artifact = kenetCandidateArtifactSchema.parse(
      readJson("public/candidates/kenet_probe_candidates.json"),
    );
    const item = artifact.items.find((entry) => entry.candidates.length > 0);
    expect(item).toBeDefined();
    const record = snapshot.mwes.find((entry) => entry.id === item!.mweId);
    expect(record).toBeDefined();
    const candidate = item!.candidates[0];
    const transformed = applyApprovedProbeCandidate(record!, candidate);
    expect(transformed.probes).toHaveLength(record!.probes.length + 1);
    expect(transformed.variants).toHaveLength(record!.variants.length + 5);
    expect(transformed.probes.find((probe) => probe.id === candidate.id)?.reviewStatus).toBe("approved");
    expect(transformed.variants.filter((variant) => variant.candidateId === candidate.id)).toHaveLength(5);
    expect(transformed.variants.filter((variant) => variant.candidateId === candidate.id).every(
      (variant) => variant.grammarReviewStatus === "review_required",
    )).toBe(true);
  });
});
