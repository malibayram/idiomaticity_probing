import {
  writeBatch,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  researchSnapshotSchema,
  annotationSchema,
  annotationAggregateSchema,
  aggregationReportSchema,
  annotationPilotPlanSchema,
  assignmentSchema,
  campaignSchema,
  exampleCandidateArtifactSchema,
  exampleCandidateSchema,
  exampleReviewSchema,
  jobSchema,
  kenetCandidateArtifactSchema,
  probeCandidateSchema,
  randomProbeCandidateArtifactSchema,
  referenceDatasetIndexSchema,
  referenceDatasetLanguageSchema,
  ordinaryControlArtifactSchema,
  ordinaryControlReviewSchema,
  mweSchema,
  probeReviewSchema,
  sourceSchema,
  validationReportSchema,
  type AnnotationRecord,
  type AnnotationAggregate,
  type AggregationReport,
  type AnnotationPilotPlan,
  type AssignmentRecord,
  type CampaignRecord,
  type ExampleCandidate,
  type ExampleCandidateArtifact,
  type ExampleReviewRecord,
  type ProbeCandidateRecord,
  type RandomProbeCandidateArtifact,
  type ReferenceDatasetIndex,
  type ReferenceDatasetLanguage,
  type OrdinaryControlArtifact,
  type OrdinaryControlItem,
  type OrdinaryControlReview,
  type JobRecord,
  type KenetCandidateArtifact,
  type MweRecord,
  type ProbeReviewRecord,
  type ResearchSnapshot,
  type SourceRecord,
  type ValidationReport,
} from "@/data/schema";
import type { Role } from "@/lib/roles";
import { applyApprovedProbeCandidate } from "@/data/probe-transform";
import { applyApprovedExampleCandidate, type NaturalContextSlot } from "@/data/context-transform";
import { buildPilotAssignments, buildPreAnnotationAssignments } from "@/data/assignment-plan";
import { aggregateAcceptedAnnotations } from "@/data/annotation-aggregation";
import { tx } from "@/i18n";
import { loadPublicDataset } from "@/lib/public-publication";

export { applyApprovedProbeCandidate } from "@/data/probe-transform";
export { applyApprovedExampleCandidate } from "@/data/context-transform";

export const ACTIVE_PROJECT_ID = import.meta.env.VITE_PROJECT_ID || "tr-ncimp";

const CURATION_ARTIFACT_IDS = {
  kenet: "tr-kenet-probes-v1",
  random: "tr-random-probes-v1",
  examples: "tr-tatoeba-examples-v1",
  annotationPlan: "tr-annotation-pilot-v1",
} as const;

function normalizeFirestoreValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value
      && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, normalizeFirestoreValue(item)]),
    );
  }
  return value;
}

export async function loadBundledSeed(): Promise<ResearchSnapshot> {
  const response = await fetch("/seed/tr_project.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.localSeedLoadFailed"));
  return researchSnapshotSchema.parse(await response.json());
}

async function loadProtectedArtifactWithItems(artifactId: string) {
  const [metadataSnapshot, itemSnapshot] = await Promise.all([
    getDoc(doc(db, "candidateArtifacts", artifactId)),
    getDocs(collection(db, "candidateArtifacts", artifactId, "items")),
  ]);
  if (!metadataSnapshot.exists()) throw new Error(`Protected curation artifact is missing: ${artifactId}`);
  const metadata = normalizeFirestoreValue(metadataSnapshot.data()) as Record<string, unknown>;
  const items = itemSnapshot.docs
    .map((item) => normalizeFirestoreValue(item.data()) as Record<string, unknown>)
    .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0));
  return { metadata, items };
}

export async function loadKenetProbeCandidates(): Promise<KenetCandidateArtifact> {
  if (import.meta.env.PROD) {
    const { metadata, items } = await loadProtectedArtifactWithItems(CURATION_ARTIFACT_IDS.kenet);
    return kenetCandidateArtifactSchema.parse({ ...metadata, items });
  }
  const response = await fetch("/candidates/kenet_probe_candidates.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.kenetProbeLoadFailed"));
  return kenetCandidateArtifactSchema.parse(await response.json());
}

export async function loadRandomProbeCandidates(): Promise<RandomProbeCandidateArtifact> {
  if (import.meta.env.PROD) {
    const { metadata, items } = await loadProtectedArtifactWithItems(CURATION_ARTIFACT_IDS.random);
    return randomProbeCandidateArtifactSchema.parse({ ...metadata, items });
  }
  const response = await fetch("/candidates/tatoeba_random_probe_candidates.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.randomProbeLoadFailed"));
  return randomProbeCandidateArtifactSchema.parse(await response.json());
}

export async function loadValidationReport(): Promise<ValidationReport> {
  const remote = await getDoc(doc(db, "validationReports", ACTIVE_PROJECT_ID));
  if (remote.exists()) return validationReportSchema.parse(normalizeFirestoreValue(remote.data()));
  const response = await fetch("/reports/tr_validation.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.validationReportLoadFailed"));
  return validationReportSchema.parse(await response.json());
}

export async function loadTatoebaExampleCandidates(): Promise<ExampleCandidateArtifact> {
  if (import.meta.env.PROD) {
    const { metadata, items } = await loadProtectedArtifactWithItems(CURATION_ARTIFACT_IDS.examples);
    const candidates = items.flatMap((item) => Array.isArray(item.candidates) ? item.candidates : []);
    return exampleCandidateArtifactSchema.parse({ ...metadata, candidates });
  }
  const response = await fetch("/candidates/tatoeba_example_candidates.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.tatoebaExampleLoadFailed"));
  return exampleCandidateArtifactSchema.parse(await response.json());
}

export async function loadAnnotationPilotPlan(): Promise<AnnotationPilotPlan> {
  if (import.meta.env.PROD) {
    const snapshot = await getDoc(doc(db, "candidateArtifacts", CURATION_ARTIFACT_IDS.annotationPlan));
    if (!snapshot.exists()) throw new Error(`Protected curation artifact is missing: ${CURATION_ARTIFACT_IDS.annotationPlan}`);
    return annotationPilotPlanSchema.parse(normalizeFirestoreValue(snapshot.data()));
  }
  const response = await fetch("/annotation/tr_pilot_plan.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.pilotPlanLoadFailed"));
  return annotationPilotPlanSchema.parse(await response.json());
}

export async function loadReferenceDatasetIndex(): Promise<ReferenceDatasetIndex> {
  const response = await fetch("/references/ncimp_en_pt_reference.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.referenceSummaryLoadFailed"));
  return referenceDatasetIndexSchema.parse(await response.json());
}

export async function loadReferenceDataset(
  language: "EN" | "PT",
): Promise<ReferenceDatasetLanguage> {
  if (import.meta.env.PROD) {
    const [published, index] = await Promise.all([
      loadPublicDataset(language),
      loadReferenceDatasetIndex(),
    ]);
    return referenceDatasetLanguageSchema.parse({
      ...index,
      language,
      summary: index.summary[language],
      items: published.items,
    });
  }
  const response = await fetch(`/references/ncimp_${language.toLowerCase()}_reference.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.referenceDatasetLoadFailed", { language }));
  return referenceDatasetLanguageSchema.parse(await response.json());
}

export async function loadOrdinaryControlArtifact(): Promise<OrdinaryControlArtifact> {
  if (import.meta.env.PROD) {
    const published = await loadPublicDataset("CTRL");
    const items = published.items;
    const groupCounts = items.reduce<Record<string, number>>((counts, item) => {
      if ("group" in item) counts[item.group] = (counts[item.group] ?? 0) + 1;
      return counts;
    }, {});
    return ordinaryControlArtifactSchema.parse({
      schemaVersion: 1,
      protocolVersion: "ncimp-ordinary-calibrated-v2",
      generatedAt: new Date().toISOString(),
      language: "TR",
      primaryAnalysisLevel: "contextual_span",
      releaseStatus: "curation_candidate",
      method: {
        articleExperiment: 4,
        groupSize: 16,
        ordinaryGapFormula: "0.5 * (gap_single_word + gap_ordinary_two_word)",
        ocgFormula: "gap_group / gap_ordinary",
        warning: "Human semantic, grammar and frequency review remains required.",
      },
      summary: { itemCount: items.length, groupCounts },
      items,
    });
  }
  const response = await fetch("/controls/turkish_ordinary_control.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.ordinaryControlLoadFailed"));
  return ordinaryControlArtifactSchema.parse(await response.json());
}

export async function listOrdinaryControlReviews(): Promise<OrdinaryControlReview[]> {
  const snapshot = await getDocs(collection(db, "ordinaryControlReviews"));
  return snapshot.docs.map((item) => ordinaryControlReviewSchema.parse(normalizeFirestoreValue(item.data())));
}

export async function reviewOrdinaryControlItem(
  item: OrdinaryControlItem,
  status: "approved" | "rejected",
  reviewerUid: string,
  notes: string,
): Promise<void> {
  const review = ordinaryControlReviewSchema.parse({
    id: item.item_id,
    projectId: ACTIVE_PROJECT_ID,
    itemId: item.item_id,
    status,
    notes: notes.trim(),
    reviewerUid,
    reviewedAt: new Date().toISOString(),
  });
  const batch = writeBatch(db);
  batch.set(doc(db, "ordinaryControlReviews", review.id), review);
  batch.set(doc(collection(db, "auditEvents")), {
    type: "ordinary_control_reviewed",
    projectId: ACTIVE_PROJECT_ID,
    itemId: review.itemId,
    status,
    actorUid: reviewerUid,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
}

export async function listExampleReviews(): Promise<ExampleReviewRecord[]> {
  const snapshot = await getDocs(collection(db, "exampleReviews"));
  return snapshot.docs.map((item) => exampleReviewSchema.parse(item.data()));
}

const JOB_TEMPLATE_NAMES = [
  "validate-tr",
  "export-tr-draft",
  "aggregate-tr",
  "experiment-tr-mock",
  "analyze-tr-mock",
] as const;
export type JobTemplateName = (typeof JOB_TEMPLATE_NAMES)[number];

export async function loadJobTemplate(name: JobTemplateName): Promise<JobRecord> {
  if (!JOB_TEMPLATE_NAMES.includes(name)) throw new Error(tx("errors.invalidJobTemplate"));
  const response = await fetch(`/job-templates/${name}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(tx("errors.jobTemplateLoadFailed", { name }));
  return jobSchema.parse(await response.json());
}

export async function listProbeReviews(): Promise<ProbeReviewRecord[]> {
  const snapshot = await getDocs(collection(db, "probeReviews"));
  return snapshot.docs.map((item) => probeReviewSchema.parse(item.data()));
}

export interface SnapshotAccess {
  uid: string;
  role: Role;
}

export async function loadResearchSnapshot(
  projectId = ACTIVE_PROJECT_ID,
  access?: SnapshotAccess,
): Promise<ResearchSnapshot | null> {
  const projectRef = doc(db, "projects", projectId);
  const projectDoc = await getDoc(projectRef);
  if (!projectDoc.exists()) return null;
  const isPrivileged = access?.role === "curator" || access?.role === "admin";
  const assignmentQuery = isPrivileged
    ? collection(db, "assignments")
    : access?.role === "annotator"
      ? query(collection(db, "assignments"), where("assigneeId", "==", access.uid))
      : null;
  const annotationQuery = isPrivileged
    ? collection(db, "annotations")
    : access?.role === "annotator"
      ? query(collection(db, "annotations"), where("annotatorId", "==", access.uid))
      : null;
  const [mwes, sources, campaigns, assignments, annotations, jobs, runs, ordinaryControlReviews] = await Promise.all([
    getDocs(collection(projectRef, "mwes")),
    getDocs(collection(db, "sources")),
    getDocs(collection(db, "campaigns")),
    assignmentQuery ? getDocs(assignmentQuery) : Promise.resolve(null),
    annotationQuery ? getDocs(annotationQuery) : Promise.resolve(null),
    getDocs(collection(db, "jobs")),
    getDocs(collection(db, "runs")),
    getDocs(collection(db, "ordinaryControlReviews")),
  ]);
  return researchSnapshotSchema.parse(normalizeFirestoreValue({
    schemaVersion: projectDoc.data().schemaVersion ?? 1,
    generatedAt: projectDoc.data().generatedAt ?? new Date().toISOString(),
    project: projectDoc.data(),
    mwes: mwes.docs.map((item) => item.data()),
    sources: sources.docs.map((item) => item.data()),
    campaigns: campaigns.docs.map((item) => item.data()),
    assignments: assignments?.docs.map((item) => item.data()) ?? [],
    annotations: annotations?.docs.map((item) => item.data()) ?? [],
    jobs: jobs.docs.map((item) => item.data()),
    runs: runs.docs.map((item) => item.data()),
    ordinaryControlReviews: ordinaryControlReviews.docs.map((item) => item.data()),
  }));
}

/** Initial seed is create-once so a later click cannot overwrite live curation. */
export async function seedResearchProject(snapshot: ResearchSnapshot, actorUid: string): Promise<void> {
  researchSnapshotSchema.parse(snapshot);
  const existing = await getDoc(doc(db, "projects", snapshot.project.id));
  if (existing.exists()) {
    throw new Error(tx("errors.projectAlreadySeeded"));
  }
  const batch = writeBatch(db);
  const projectRef = doc(db, "projects", snapshot.project.id);
  batch.set(projectRef, {
    ...snapshot.project,
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    seededAt: serverTimestamp(),
    seededBy: actorUid,
  }, { merge: true });
  for (const record of snapshot.mwes) batch.set(doc(projectRef, "mwes", record.id), record, { merge: true });
  for (const record of snapshot.sources) batch.set(doc(db, "sources", record.id), record, { merge: true });
  for (const record of snapshot.campaigns) batch.set(doc(db, "campaigns", record.id), record, { merge: true });
  for (const record of snapshot.jobs) batch.set(doc(db, "jobs", record.id), record, { merge: true });
  for (const record of snapshot.runs) batch.set(doc(db, "runs", record.id), record, { merge: true });
  const auditRef = doc(collection(db, "auditEvents"));
  batch.set(auditRef, {
    type: "project_seeded",
    actorUid,
    projectId: snapshot.project.id,
    counts: { mwes: snapshot.mwes.length, sources: snapshot.sources.length, runs: snapshot.runs.length },
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
}

export async function saveMwe(
  record: MweRecord,
  actorUid: string,
): Promise<MweRecord> {
  const validated = mweSchema.parse(record);
  const ref = doc(db, "projects", validated.projectId, "mwes", validated.id);
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    const currentRevision = current.exists() ? Number(current.data().revision ?? 0) : 0;
    if (current.exists() && currentRevision !== validated.revision) {
      throw new Error(tx("errors.recordConflict", { expected: validated.revision, current: currentRevision }));
    }
    const next = {
      ...validated,
      revision: currentRevision + 1,
      updatedAt: new Date().toISOString(),
    };
    transaction.set(ref, next, { merge: true });
    transaction.set(doc(collection(db, "auditEvents")), {
      type: "mwe_updated",
      projectId: validated.projectId,
      mweId: validated.id,
      actorUid,
      fromRevision: currentRevision,
      toRevision: next.revision,
      createdAt: serverTimestamp(),
      schemaVersion: 1,
    });
    return next;
  });
}

export async function reviewProbeCandidate(
  record: MweRecord,
  rawCandidate: ProbeCandidateRecord,
  status: "approved" | "rejected",
  reviewerUid: string,
  notes: string,
): Promise<MweRecord> {
  const candidate = probeCandidateSchema.parse(rawCandidate);
  const mwe = mweSchema.parse(record);
  const mweRef = doc(db, "projects", mwe.projectId, "mwes", mwe.id);
  const review: ProbeReviewRecord = probeReviewSchema.parse({
    id: candidate.id,
    projectId: mwe.projectId,
    candidateId: candidate.id,
    mweId: mwe.id,
    status,
    notes,
    reviewerUid,
    reviewedAt: new Date().toISOString(),
  });

  return runTransaction(db, async (transaction) => {
    const currentDoc = await transaction.get(mweRef);
    if (!currentDoc.exists()) throw new Error(tx("errors.mweFirestoreMissing"));
    const current = mweSchema.parse(currentDoc.data());
    if (current.revision !== mwe.revision) {
      throw new Error(tx("errors.mweRevisionConflict", { revision: current.revision }));
    }
    const targetByKind: Record<ProbeCandidateRecord["kind"], number> = {
      P_Syn: 1, P_Comp: 2, P_WordsSyn: 5, P_Rand: 5,
    };
    if (status === "approved" && !current.probes.some((item) => item.id === candidate.id)) {
      const approvedCount = current.probes.filter((item) => item.kind === candidate.kind && item.reviewStatus === "approved").length;
      if (approvedCount >= targetByKind[candidate.kind]) {
        throw new Error(tx("errors.probeTargetFull", { kind: candidate.kind, approved: approvedCount, target: targetByKind[candidate.kind] }));
      }
    }
    const transformed = status === "approved" ? applyApprovedProbeCandidate(current, candidate) : current;
    const next = {
      ...transformed,
      revision: current.revision + (status === "approved" ? 1 : 0),
      updatedAt: status === "approved" ? review.reviewedAt : current.updatedAt,
    };
    if (status === "approved") transaction.set(mweRef, next, { merge: true });
    transaction.set(doc(db, "probeReviews", review.id), review);
    transaction.set(doc(collection(db, "auditEvents")), {
      type: "probe_candidate_reviewed",
      projectId: mwe.projectId,
      mweId: mwe.id,
      candidateId: candidate.id,
      status,
      actorUid: reviewerUid,
      createdAt: serverTimestamp(),
      schemaVersion: 1,
    });
    return mweSchema.parse(next);
  });
}

export async function reviewExampleCandidate(
  record: MweRecord,
  rawCandidate: ExampleCandidate,
  status: "approved" | "rejected",
  targetSlot: NaturalContextSlot | null,
  reviewerUid: string,
  notes: string,
): Promise<MweRecord> {
  const candidate = exampleCandidateSchema.parse(rawCandidate);
  const mwe = mweSchema.parse(record);
  if (candidate.mweId !== mwe.id) throw new Error(tx("errors.exampleCandidateMismatch"));
  if (status === "approved" && !targetSlot) throw new Error(tx("errors.approvalSlotRequired"));
  const mweRef = doc(db, "projects", mwe.projectId, "mwes", mwe.id);
  const review: ExampleReviewRecord = exampleReviewSchema.parse({
    id: candidate.id,
    projectId: mwe.projectId,
    candidateId: candidate.id,
    mweId: mwe.id,
    status,
    targetSlot,
    notes,
    reviewerUid,
    reviewedAt: new Date().toISOString(),
  });

  return runTransaction(db, async (transaction) => {
    const currentDoc = await transaction.get(mweRef);
    if (!currentDoc.exists()) throw new Error(tx("errors.mweFirestoreMissing"));
    const current = mweSchema.parse(currentDoc.data());
    if (current.revision !== mwe.revision) {
      throw new Error(tx("errors.mweRevisionConflict", { revision: current.revision }));
    }
    const transformed = status === "approved"
      ? applyApprovedExampleCandidate(current, candidate, targetSlot!)
      : current;
    const next = {
      ...transformed,
      revision: current.revision + (status === "approved" ? 1 : 0),
      updatedAt: status === "approved" ? review.reviewedAt : current.updatedAt,
    };
    if (status === "approved") transaction.set(mweRef, next, { merge: true });
    transaction.set(doc(db, "exampleReviews", review.id), review);
    transaction.set(doc(collection(db, "auditEvents")), {
      type: "example_candidate_reviewed",
      projectId: mwe.projectId,
      mweId: mwe.id,
      candidateId: candidate.id,
      targetSlot,
      status,
      actorUid: reviewerUid,
      createdAt: serverTimestamp(),
      schemaVersion: 1,
    });
    return mweSchema.parse(next);
  });
}

async function mutateMweWithAudit(
  record: MweRecord,
  actorUid: string,
  eventType: string,
  metadata: Record<string, unknown>,
  transform: (current: MweRecord) => MweRecord,
): Promise<MweRecord> {
  const mwe = mweSchema.parse(record);
  const mweRef = doc(db, "projects", mwe.projectId, "mwes", mwe.id);
  return runTransaction(db, async (transaction) => {
    const currentDoc = await transaction.get(mweRef);
    if (!currentDoc.exists()) throw new Error(tx("errors.mweFirestoreMissing"));
    const current = mweSchema.parse(currentDoc.data());
    if (current.revision !== mwe.revision) throw new Error(tx("errors.mweRevisionConflict", { revision: current.revision }));
    const next = mweSchema.parse({
      ...transform(current),
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    transaction.set(mweRef, next, { merge: true });
    transaction.set(doc(collection(db, "auditEvents")), {
      type: eventType,
      projectId: mwe.projectId,
      mweId: mwe.id,
      ...metadata,
      actorUid,
      createdAt: serverTimestamp(),
      schemaVersion: 1,
    });
    return next;
  });
}

export async function reviewContext(
  record: MweRecord,
  contextId: string,
  status: "approved" | "rejected",
  actorUid: string,
  notes: string,
): Promise<MweRecord> {
  if (!record.contexts.some((context) => context.id === contextId)) throw new Error(tx("errors.contextNotInMwe"));
  return mutateMweWithAudit(record, actorUid, "context_reviewed", { contextId, status, notes: notes.trim() }, (current) => ({
    ...current,
    contexts: current.contexts.map((context) => context.id === contextId ? { ...context, reviewStatus: status } : context),
  }));
}

export async function reviewExistingProbe(
  record: MweRecord,
  probeId: string,
  status: "approved" | "rejected",
  actorUid: string,
  notes: string,
): Promise<MweRecord> {
  if (!record.probes.some((probe) => probe.id === probeId)) throw new Error(tx("errors.probeNotInMwe"));
  return mutateMweWithAudit(record, actorUid, "existing_probe_reviewed", { probeId, status, notes: notes.trim() }, (current) => ({
    ...current,
    probes: current.probes.map((probe) => probe.id === probeId ? { ...probe, reviewStatus: status, notes: notes.trim() || probe.notes } : probe),
  }));
}

export async function reviewVariantGrammar(
  record: MweRecord,
  variantId: string,
  status: "approved" | "rejected",
  actorUid: string,
  notes: string,
): Promise<MweRecord> {
  if (!record.variants.some((variant) => variant.id === variantId)) throw new Error(tx("errors.variantNotInMwe"));
  return mutateMweWithAudit(record, actorUid, "variant_grammar_reviewed", { variantId, status, notes: notes.trim() }, (current) => ({
    ...current,
    variants: current.variants.map((variant) => variant.id === variantId ? { ...variant, grammarReviewStatus: status } : variant),
  }));
}

export async function saveSource(record: SourceRecord, actorUid: string): Promise<void> {
  const validated = sourceSchema.parse(record);
  const batch = writeBatch(db);
  batch.set(doc(db, "sources", validated.id), validated, { merge: true });
  batch.set(doc(collection(db, "auditEvents")), {
    type: "source_updated",
    sourceId: validated.id,
    actorUid,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
}

export async function saveCampaign(record: CampaignRecord, actorUid: string): Promise<void> {
  const validated = campaignSchema.parse(record);
  await setDoc(doc(db, "campaigns", validated.id), {
    ...validated,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  }, { merge: true });
}

export async function createAssignments(records: AssignmentRecord[]): Promise<void> {
  const chunkSize = 400;
  for (let offset = 0; offset < records.length; offset += chunkSize) {
    const batch = writeBatch(db);
    for (const record of records.slice(offset, offset + chunkSize)) {
      batch.set(doc(db, "assignments", record.id), assignmentSchema.parse(record));
    }
    await batch.commit();
  }
}

export async function launchPilotCampaign(
  plan: AnnotationPilotPlan,
  taskType: "type" | "token",
  annotatorIds: string[],
  actorUid: string,
): Promise<number> {
  const validatedPlan = annotationPilotPlanSchema.parse(plan);
  const campaignId = validatedPlan.campaigns[taskType].id;
  const existingCampaign = await getDoc(doc(db, "campaigns", campaignId));
  if (existingCampaign.exists() && existingCampaign.data().launchedAt) {
    throw new Error(tx("errors.pilotCampaignExists"));
  }
  const assignments = buildPilotAssignments(validatedPlan, taskType, annotatorIds);
  await createAssignments(assignments);
  const campaign = validatedPlan.campaigns[taskType];
  const batch = writeBatch(db);
  batch.set(doc(db, "campaigns", campaign.id), {
    status: "pilot",
    totalAssignments: assignments.length,
    completedAssignments: 0,
    annotatorIds: [...new Set(annotatorIds)].sort(),
    launchedAt: new Date().toISOString(),
    launchedBy: actorUid,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  batch.set(doc(collection(db, "auditEvents")), {
    type: "annotation_pilot_launched",
    projectId: validatedPlan.projectId,
    campaignId: campaign.id,
    taskType,
    assignmentCount: assignments.length,
    actorUid,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
  return assignments.length;
}

export async function launchPreAnnotationCampaign(
  plan: AnnotationPilotPlan,
  taskType: "type" | "token",
  assigneeId: string,
  actorUid: string,
): Promise<number> {
  const validatedPlan = annotationPilotPlanSchema.parse(plan);
  const campaignId = `tr-prelabel-${taskType}-v1`;
  const existingCampaign = await getDoc(doc(db, "campaigns", campaignId));
  if (existingCampaign.exists()) {
    throw new Error(tx("errors.prelabelCampaignExists"));
  }
  const assignments = buildPreAnnotationAssignments(validatedPlan, taskType, assigneeId);
  await createAssignments(assignments);
  const batch = writeBatch(db);
  batch.set(doc(db, "campaigns", campaignId), {
    id: campaignId,
    name: `TR ${taskType} ön etiketleme`,
    taskType,
    status: "active",
    targetAnnotators: 1,
    itemCount: assignments.length,
    completedAssignments: 0,
    totalAssignments: assignments.length,
    annotatorIds: [assigneeId],
    purpose: "curator_prelabel",
    eligibleForGold: false,
    launchedAt: new Date().toISOString(),
    launchedBy: actorUid,
  }, { merge: true });
  batch.set(doc(collection(db, "auditEvents")), {
    type: "annotation_prelabel_launched",
    projectId: validatedPlan.projectId,
    campaignId,
    taskType,
    assignmentCount: assignments.length,
    actorUid,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
  return assignments.length;
}

export async function submitAnnotation(record: AnnotationRecord): Promise<void> {
  const validated = annotationSchema.parse(record);
  if (validated.id !== validated.assignmentId) {
    throw new Error(tx("errors.annotationIdMismatch"));
  }
  const batch = writeBatch(db);
  batch.set(doc(db, "annotations", validated.id), validated);
  batch.update(doc(db, "assignments", validated.assignmentId), {
    status: "submitted",
    submittedAt: validated.submittedAt,
  });
  await batch.commit();
}

export async function startAssignment(assignmentId: string): Promise<void> {
  await updateDoc(doc(db, "assignments", assignmentId), {
    status: "in_progress",
    startedAt: new Date().toISOString(),
  });
}

export async function reviewAssignment(
  assignmentId: string,
  status: "accepted" | "excluded",
  actorUid: string,
  reason: string,
): Promise<void> {
  const assignmentRef = doc(db, "assignments", assignmentId);
  await runTransaction(db, async (transaction) => {
    const assignmentDoc = await transaction.get(assignmentRef);
    if (!assignmentDoc.exists()) throw new Error(tx("errors.assignmentNotFound"));
    const assignment = assignmentSchema.parse(assignmentDoc.data());
    if (assignment.campaignId.startsWith("tr-prelabel-")) {
      throw new Error(tx("errors.prelabelNotGold"));
    }
    if (assignment.status !== "submitted") {
      throw new Error(tx("errors.onlySubmittedReviewable"));
    }
    const campaignRef = doc(db, "campaigns", assignment.campaignId);
    const campaignDoc = await transaction.get(campaignRef);
    transaction.update(assignmentRef, {
      status,
      reviewReason: reason.trim(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorUid,
    });
    if (campaignDoc.exists()) {
      const campaign = campaignSchema.parse(campaignDoc.data());
      transaction.update(campaignRef, {
        completedAssignments: Math.min(campaign.totalAssignments, campaign.completedAssignments + 1),
        updatedAt: new Date().toISOString(),
      });
    }
    transaction.set(doc(collection(db, "auditEvents")), {
      type: "annotation_assignment_reviewed",
      assignmentId,
      status,
      reason: reason.trim(),
      actorUid,
      createdAt: serverTimestamp(),
      schemaVersion: 1,
    });
  });
}

export async function listAnnotationAggregates(): Promise<AnnotationAggregate[]> {
  const snapshot = await getDocs(collection(db, "annotationAggregates"));
  return snapshot.docs.map((item) => annotationAggregateSchema.parse(normalizeFirestoreValue(item.data())));
}

export async function loadAggregationReport(): Promise<AggregationReport | null> {
  const snapshot = await getDoc(doc(db, "aggregationReports", ACTIVE_PROJECT_ID));
  if (!snapshot.exists()) return null;
  return aggregationReportSchema.parse(normalizeFirestoreValue(snapshot.data()));
}

export async function aggregateAnnotationsNow(
  annotations: AnnotationRecord[],
  assignments: AssignmentRecord[],
  actorUid: string,
): Promise<AggregationReport> {
  const result = aggregateAcceptedAnnotations(annotations, assignments);
  const generatedAt = new Date().toISOString();
  const jobId = `browser-aggregate-${Date.now()}`;
  for (let offset = 0; offset < result.items.length; offset += 400) {
    const batch = writeBatch(db);
    for (const item of result.items.slice(offset, offset + 400)) {
      const id = `${item.mweId}--${item.contextId ?? "TYPE"}`;
      const record = annotationAggregateSchema.parse({
        id, projectId: ACTIVE_PROJECT_ID, jobId, generatedAt, ...item,
      });
      batch.set(doc(db, "annotationAggregates", id), record);
    }
    await batch.commit();
  }
  const report = aggregationReportSchema.parse({
    projectId: ACTIVE_PROJECT_ID,
    jobId,
    generatedAt,
    itemCount: result.items.length,
    requiresAdjudicationCount: result.items.filter((item) => item.requiresAdjudication).length,
    ordinalKrippendorffAlpha: result.ordinalKrippendorffAlpha,
    iccOneWayAverage: result.iccOneWayAverage,
  });
  const batch = writeBatch(db);
  batch.set(doc(db, "aggregationReports", ACTIVE_PROJECT_ID), report);
  batch.set(doc(collection(db, "auditEvents")), {
    type: "annotations_aggregated_in_browser",
    projectId: ACTIVE_PROJECT_ID,
    itemCount: report.itemCount,
    actorUid,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
  return report;
}

export async function adjudicateMwe(
  record: MweRecord,
  goldScore: number,
  goldClass: "I" | "PC" | "C",
  actorUid: string,
  notes: string,
): Promise<MweRecord> {
  if (goldScore < 0 || goldScore > 5) throw new Error(tx("errors.goldScoreRange"));
  const mwe = mweSchema.parse(record);
  const mweRef = doc(db, "projects", mwe.projectId, "mwes", mwe.id);
  return runTransaction(db, async (transaction) => {
    const currentDoc = await transaction.get(mweRef);
    if (!currentDoc.exists()) throw new Error(tx("errors.mweNotFound"));
    const current = mweSchema.parse(currentDoc.data());
    if (current.revision !== mwe.revision) {
      throw new Error(tx("errors.mweRevisionConflict", { revision: current.revision }));
    }
    const updatedAt = new Date().toISOString();
    const next = mweSchema.parse({
      ...current,
      goldScore,
      goldClass,
      annotationStatus: "adjudicated",
      workflowStatus: current.workflowStatus === "draft" || current.workflowStatus === "examples_ready"
        ? "annotated"
        : current.workflowStatus,
      notes: notes.trim() ? `${current.notes}\nAdjudication: ${notes.trim()}`.trim() : current.notes,
      revision: current.revision + 1,
      updatedAt,
    });
    transaction.set(mweRef, next, { merge: true });
    transaction.set(doc(collection(db, "auditEvents")), {
      type: "mwe_gold_adjudicated",
      projectId: mwe.projectId,
      mweId: mwe.id,
      goldScore,
      goldClass,
      notes: notes.trim(),
      actorUid,
      createdAt: serverTimestamp(),
      schemaVersion: 1,
    });
    return next;
  });
}

export async function queueJob(record: JobRecord, actorUid: string): Promise<void> {
  const validated = jobSchema.parse(record);
  await setDoc(doc(db, "jobs", validated.id), {
    ...validated,
    createdBy: actorUid,
    cancelRequested: false,
  });
}

export async function requestJobCancellation(jobId: string): Promise<void> {
  await updateDoc(doc(db, "jobs", jobId), { cancelRequested: true });
}

export async function approveUser(
  uid: string,
  role: Exclude<Role, "pending">,
  actorUid: string,
): Promise<void> {
  return setUserRole(uid, role, actorUid);
}

export async function setUserRole(
  uid: string,
  role: Role,
  actorUid: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), {
    role,
    ...(role === "pending" ? {} : {
      approvedAt: new Date().toISOString(),
      approvedBy: actorUid,
    }),
    updatedAt: new Date().toISOString(),
  });
  batch.set(doc(collection(db, "auditEvents")), {
    type: "user_role_changed",
    targetUid: uid,
    role,
    actorUid,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  await batch.commit();
}

export async function listUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map((item) => item.data());
}
