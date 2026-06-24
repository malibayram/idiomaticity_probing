import { z } from "zod";

export const roleSchema = z.enum(["pending", "annotator", "curator", "viewer", "admin"]);
export const compClassSchema = z.enum(["I", "PC", "C"]);
export const workflowStatusSchema = z.enum([
  "draft", "examples_ready", "annotation_ready", "annotated", "probes_ready",
  "variants_reviewed", "release_ready", "released",
]);
export const reviewStatusSchema = z.enum(["pending", "review_required", "approved", "rejected"]);
export const contextSlotSchema = z.enum(["S1", "S2", "S3", "N1", "N2"]);
export const probeKindSchema = z.enum(["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand"]);

export const provenanceSchema = z.object({
  origin: z.enum(["internet_open_license", "authored_for_dataset", "imported", "generated"]),
  sourceId: z.string().nullable().optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  license: z.string().optional(),
  licenseReviewStatus: z.string(),
  senseReviewStatus: z.string(),
});

export const contextSchema = z.object({
  id: z.string(),
  slot: contextSlotSchema,
  family: z.enum(["naturalistic", "neutral"]),
  sentence: z.string().min(1),
  targetSurface: z.string().min(1),
  span: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]).nullable(),
  provenance: provenanceSchema,
  reviewStatus: reviewStatusSchema,
});

export const probeCandidateSchema = z.object({
  id: z.string(),
  kind: probeKindSchema,
  lexicalForm: z.string().min(1),
  source: z.string(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceMweId: z.string().optional(),
  componentStrategy: z.string().optional(),
  synsetIds: z.array(z.string()).optional(),
  definitions: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  license: z.string().optional(),
  licenseReviewStatus: z.string().optional(),
  senseReviewStatus: z.string().optional(),
  grammarReviewStatus: z.string().optional(),
  semanticReviewStatus: z.string().optional(),
  notes: z.string().optional(),
  frequency: z.number().optional(),
  averageFrequency: z.number().optional(),
  targetAverageFrequency: z.number().optional(),
  logFrequencyDelta: z.number().optional(),
  reviewStatus: reviewStatusSchema,
  rank: z.number().int().positive(),
});

export const extractedProbeCandidateSchema = probeCandidateSchema.extend({
  sourceId: z.string(),
  sourceUrl: z.string(),
  componentStrategy: z.string(),
  synsetIds: z.array(z.string()),
  definitions: z.array(z.string()),
  examples: z.array(z.string()),
  license: z.string(),
  licenseReviewStatus: z.string(),
  senseReviewStatus: z.string(),
  grammarReviewStatus: z.string(),
  notes: z.string(),
});

const kenetSenseEvidenceSchema = z.object({
  synsetId: z.string(),
  partOfSpeech: z.string(),
  members: z.array(z.string()),
  definitions: z.array(z.string()),
  examples: z.array(z.string()),
  matchedQueryForm: z.string().optional(),
  matchMethod: z.string().optional(),
});

const componentSynonymSchema = z.object({
  lexicalForm: z.string(),
  synsetIds: z.array(z.string()),
  definitions: z.array(z.string()),
  examples: z.array(z.string()),
  partsOfSpeech: z.array(z.string()),
});

export const kenetCandidateItemSchema = z.object({
  mweId: z.string(),
  canonicalForm: z.string(),
  modifier: z.string(),
  head: z.string(),
  matchSummary: z.record(z.string(), z.number().int().nonnegative()),
  senseEvidence: z.object({
    fullMwe: z.array(kenetSenseEvidenceSchema),
    modifier: z.array(kenetSenseEvidenceSchema),
    head: z.array(kenetSenseEvidenceSchema),
  }),
  componentSynonyms: z.object({
    modifier: z.array(componentSynonymSchema),
    head: z.array(componentSynonymSchema),
  }),
  candidates: z.array(extractedProbeCandidateSchema),
});

export const kenetCandidateArtifactSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string(),
  projectId: z.string(),
  source: z.object({
    id: z.string(), title: z.string(), url: z.string(), snapshot: z.string(),
    snapshotSha256: z.string(), license: z.string(), licenseReviewStatus: z.string(),
  }),
  policy: z.object({
    matchType: z.string(), autoApproval: z.literal(false), pSynLimitPerMwe: z.number().int().positive(),
    pWordsSynLimitPerMwe: z.number().int().positive(), warning: z.string(),
  }),
  summary: z.record(z.string(), z.number().int().nonnegative()),
  items: z.array(kenetCandidateItemSchema),
});

export const randomProbeCandidateSchema = probeCandidateSchema.extend({
  kind: z.literal("P_Rand"),
  sourceId: z.string(),
  sourceMweId: z.string(),
  frequency: z.number().nonnegative(),
  averageFrequency: z.number().nonnegative(),
  targetAverageFrequency: z.number().nonnegative(),
  logFrequencyDelta: z.number().nonnegative(),
  componentOverlap: z.literal(false),
  meaningTokenOverlap: z.array(z.string()),
  semanticReviewStatus: z.string(),
  grammarReviewStatus: z.string(),
  license: z.string(),
  licenseReviewStatus: z.string(),
  notes: z.string(),
});

export const randomProbeCandidateArtifactSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string(),
  projectId: z.string(),
  source: z.object({
    id: z.string(), title: z.string(), snapshot: z.string(), license: z.string(),
    tokenCount: z.number().int().positive(),
  }),
  method: z.object({
    formula: z.string(), frequencyUnit: z.string(), distance: z.string(), candidateUniverse: z.string(),
    candidateCountPerMwe: z.number().int().positive(), autoApproval: z.literal(false),
    limitations: z.array(z.string()),
  }),
  summary: z.object({
    mweCount: z.number().int().nonnegative(), candidateCount: z.number().int().nonnegative(),
    mwesWithFiveOrMoreCandidates: z.number().int().nonnegative(),
    zeroCompoundFrequencyMwes: z.number().int().nonnegative(),
  }),
  items: z.array(z.object({
    mweId: z.string(), canonicalForm: z.string(),
    targetFrequency: z.object({
      compoundFrequencyPerMillion: z.number().nonnegative(),
      modifierFrequencyPerMillion: z.number().nonnegative(),
      headFrequencyPerMillion: z.number().nonnegative(),
      averageFrequencyPerMillion: z.number().nonnegative(),
    }),
    candidates: z.array(randomProbeCandidateSchema),
  })),
});

export const probeReviewSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  candidateId: z.string(),
  mweId: z.string(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string(),
  reviewerUid: z.string(),
  reviewedAt: z.string(),
});

export const validationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  mwe_id: z.string().nullable(),
  context_id: z.string().nullable(),
});

export const validationReportSchema = z.object({
  schemaVersion: z.number().int().positive(),
  projectId: z.string(),
  releaseReady: z.boolean(),
  metrics: z.object({
    mweCount: z.number().int().nonnegative(),
    contextCount: z.number().int().nonnegative(),
    sentenceCount: z.number().int().nonnegative(),
    naturalContextCount: z.number().int().nonnegative(),
    externalContextCount: z.number().int().nonnegative(),
    acceptedAnnotationCount: z.number().int().nonnegative(),
    ordinaryControlApprovedCount: z.number().int().nonnegative().optional(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
  }),
  gateCounts: z.record(z.string(), z.number().int().nonnegative()),
  issues: z.array(validationIssueSchema),
});

export const annotationAggregateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  mweId: z.string(),
  contextId: z.string().nullable(),
  taskType: z.enum(["type", "token"]),
  n: z.number().int().nonnegative(),
  mean: z.number(), median: z.number(), stdev: z.number(),
  ci95Low: z.number(), ci95High: z.number(),
  modifierMean: z.number(), headMean: z.number(), confidenceMean: z.number(),
  requiresAdjudication: z.boolean(),
  paraphrases: z.array(z.string()),
  jobId: z.string(),
  generatedAt: z.string(),
});

export const aggregationReportSchema = z.object({
  projectId: z.string(), jobId: z.string(), generatedAt: z.string(),
  itemCount: z.number().int().nonnegative(),
  requiresAdjudicationCount: z.number().int().nonnegative(),
  ordinalKrippendorffAlpha: z.number().nullable(),
  iccOneWayAverage: z.number().nullable(),
});

export const exampleCandidateSchema = z.object({
  id: z.string(),
  mweId: z.string(),
  canonicalForm: z.string(),
  provisionalClass: compClassSchema,
  sentence: z.string().min(1),
  targetSurface: z.string().min(1),
  sourceId: z.string(),
  sourceRecordId: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  author: z.string().nullable(),
  license: z.string(),
  licenseReviewStatus: z.string(),
  senseReviewStatus: z.string(),
  reviewStatus: reviewStatusSchema,
  datasetStatus: z.enum(["already_selected", "candidate"]),
  selectedSlot: contextSlotSchema.nullable(),
});

export const exampleCandidateArtifactSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string(),
  projectId: z.string(),
  source: z.object({
    id: z.string(), title: z.string(), url: z.string(), snapshot: z.string(),
    snapshotSha256: z.string(), license: z.string(),
  }),
  policy: z.object({
    matchType: z.string(), autoApproval: z.literal(false), limitPerMwe: z.number().int().positive(),
    warning: z.string(),
  }),
  summary: z.object({
    mweCount: z.number().int().nonnegative(), candidateCount: z.number().int().nonnegative(),
    alreadySelectedCount: z.number().int().nonnegative(), newReviewCandidateCount: z.number().int().nonnegative(),
    mwesWithAnyMatch: z.number().int().nonnegative(), mwesWithoutMatch: z.number().int().nonnegative(),
    maxMatchesPerMwe: z.number().int().nonnegative(),
    matchesByProvisionalClass: z.record(z.string(), z.number().int().nonnegative()),
  }),
  candidates: z.array(exampleCandidateSchema),
});

export const exampleReviewSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  candidateId: z.string(),
  mweId: z.string(),
  status: z.enum(["approved", "rejected"]),
  targetSlot: z.enum(["S1", "S2", "S3"]).nullable(),
  notes: z.string(),
  reviewerUid: z.string(),
  reviewedAt: z.string(),
});

const referenceVariantSchema = z.object({
  sentence: z.string(), targetSurface: z.string(),
  span: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
  sourceColumn: z.string(),
});

const referenceSummarySchema = z.object({
  officialPaperMweCount: z.number().int().positive(),
  rawSnapshotMweCount: z.number().int().positive(),
  scoredMweCount: z.number().int().nonnegative(),
  unscoredMweCount: z.number().int().nonnegative(),
  contextCount: z.number().int().nonnegative(),
  naturalContextCount: z.number().int().nonnegative(),
  neutralContextCount: z.number().int().nonnegative(),
  classCountsFromLocalWorkbook: z.record(z.string(), z.number().int().nonnegative()),
});

const referenceCommonSchema = z.object({
  schemaVersion: z.number().int().positive(), generatedAt: z.string(), readOnly: z.literal(true),
  source: z.object({
    title: z.string(), url: z.string(), scoreFile: z.string(), license: z.string(),
    licenseReviewStatus: z.string(),
  }),
  protocol: z.object({
    primaryAnalysisLevel: z.literal("contextual_span"),
    contextSlots: z.array(z.enum(["S1", "S2", "S3", "N1", "N2"])),
    probeKinds: z.array(probeKindSchema),
    expectedVariantsPerContext: z.record(z.string(), z.number().int().nonnegative()),
    warning: z.string(),
  }),
  knownAnomalies: z.array(z.string()),
});

export const referenceDatasetIndexSchema = referenceCommonSchema.extend({
  summary: z.record(z.enum(["EN", "PT"]), referenceSummarySchema),
  files: z.record(z.enum(["EN", "PT"]), z.string()),
});

export const referenceDatasetLanguageSchema = referenceCommonSchema.extend({
  language: z.enum(["EN", "PT"]),
  summary: referenceSummarySchema,
  items: z.array(z.object({
    id: z.string(), language: z.enum(["EN", "PT"]), canonicalForm: z.string(),
    modifier: z.string(), head: z.string(), goldClass: compClassSchema.nullable(),
    goldScore: z.number().min(0).max(5).nullable(), scoreStatus: z.string(),
    contexts: z.array(z.object({
      id: z.string(), slot: z.enum(["S1", "S2", "S3", "N1", "N2"]),
      family: z.enum(["naturalistic", "neutral"]), original: referenceVariantSchema,
      probes: z.object({
        P_Syn: z.array(referenceVariantSchema), P_Comp: z.array(referenceVariantSchema),
        P_WordsSyn: z.array(referenceVariantSchema), P_Rand: z.array(referenceVariantSchema),
      }),
      sourceFile: z.string(),
    })).length(5),
  })),
});

export const ordinaryControlItemSchema = z.object({
  item_id: z.string(), language: z.literal("TR"),
  group: z.enum(["idiomatic_nc", "compositional_nc", "single_word_control", "ordinary_two_word_control"]),
  source_mwe_id: z.string(), name: z.string(), original: z.string(), target: z.string(),
  synonym: z.string(), component: z.string(), word_by_word: z.string(), related: z.string(),
  random: z.string(), sentence_origin: z.literal("authored_for_dataset"), source_name: z.string(),
  source_url: z.string(), license: z.string(), license_review_status: z.string(),
  semantic_review_status: z.string(), grammar_review_status: z.string(),
  frequency_match_status: z.string(), review_status: reviewStatusSchema,
  primary_level: z.literal("contextual_span"), notes: z.string(),
});

export const ordinaryControlArtifactSchema = z.object({
  schemaVersion: z.number().int().positive(), protocolVersion: z.string(), generatedAt: z.string(),
  language: z.literal("TR"), primaryAnalysisLevel: z.literal("contextual_span"),
  releaseStatus: z.literal("curation_candidate"),
  method: z.object({
    articleExperiment: z.literal(4), groupSize: z.number().int().positive(),
    ordinaryGapFormula: z.string(), ocgFormula: z.string(), warning: z.string(),
  }),
  summary: z.object({
    itemCount: z.number().int().positive(),
    groupCounts: z.record(z.string(), z.number().int().nonnegative()),
  }),
  items: z.array(ordinaryControlItemSchema),
});

export const ordinaryControlReviewSchema = z.object({
  id: z.string(), projectId: z.string(), itemId: z.string(),
  status: z.enum(["approved", "rejected"]), notes: z.string(),
  reviewerUid: z.string(), reviewedAt: z.string(),
});

export const variantSchema = z.object({
  id: z.string(),
  contextId: z.string(),
  probeKind: probeKindSchema,
  candidateId: z.string(),
  sentence: z.string().min(1),
  targetSurface: z.string().min(1),
  span: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
  grammarReviewStatus: reviewStatusSchema,
});

export const mweSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  language: z.enum(["TR", "EN", "PT"]),
  canonicalForm: z.string().min(1),
  modifier: z.string().min(1),
  head: z.string().min(1),
  tokenCount: z.number().int().positive(),
  meaning: z.string().min(1),
  provisionalClass: compClassSchema,
  goldClass: compClassSchema.nullable().optional(),
  goldScore: z.number().min(0).max(5).nullable().optional(),
  workflowStatus: workflowStatusSchema,
  annotationStatus: z.string(),
  contexts: z.array(contextSchema).length(5),
  probes: z.array(probeCandidateSchema),
  variants: z.array(variantSchema),
  notes: z.string(),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
});

export const sourceSchema = z.object({
  id: z.string(), title: z.string(), category: z.string(), status: z.string(),
  priority: z.enum(["P0", "P1", "P2"]), url: z.string(), paperUrl: z.string().nullable().optional(),
  license: z.string(), observedSize: z.string(), useForNcimp: z.string(), notes: z.string(), lastChecked: z.string(),
});

export const campaignSchema = z.object({
  id: z.string(), name: z.string(), taskType: z.enum(["type", "token"]),
  status: z.enum(["draft", "pilot", "active", "paused", "completed"]),
  targetAnnotators: z.number().int().positive(), itemCount: z.number().int().nonnegative(),
  completedAssignments: z.number().int().nonnegative(), totalAssignments: z.number().int().nonnegative(),
  agreement: z.number().optional(),
});

export const annotationItemSnapshotSchema = z.object({
  taskType: z.enum(["type", "token"]),
  mweId: z.string(),
  canonicalForm: z.string(),
  modifier: z.string(),
  head: z.string(),
  meaning: z.string(),
  contexts: z.array(z.object({
    id: z.string(),
    slot: z.enum(["S1", "S2", "S3"]),
    sentence: z.string(),
    targetSurface: z.string(),
    span: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
  })).min(1).max(3),
});

const pilotItemSchema = z.object({
  id: z.string(),
  mweId: z.string(),
  contextId: z.string().nullable(),
  itemSnapshotHash: z.string(),
  itemSnapshot: annotationItemSnapshotSchema,
});

export const annotationPilotPlanSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string(),
  projectId: z.string(),
  selection: z.object({
    seed: z.number().int(), perClass: z.number().int().positive(),
    selectedMweIds: z.array(z.string()), warning: z.string(),
  }),
  campaigns: z.object({
    type: z.object({ id: z.string(), targetAnnotators: z.number().int().positive(), items: z.array(pilotItemSchema) }),
    token: z.object({ id: z.string(), targetAnnotators: z.number().int().positive(), items: z.array(pilotItemSchema) }),
  }),
});

export const assignmentSchema = z.object({
  id: z.string(), campaignId: z.string(), assigneeId: z.string(), mweId: z.string(),
  contextId: z.string().nullable().optional(), status: z.enum(["assigned", "in_progress", "submitted", "accepted", "excluded"]),
  itemSnapshotHash: z.string(), itemSnapshot: annotationItemSnapshotSchema,
});

export const annotationSchema = z.object({
  id: z.string(), assignmentId: z.string(), campaignId: z.string(), annotatorId: z.string(), mweId: z.string(),
  contextId: z.string().nullable().optional(), overallScore: z.number().min(0).max(5), modifierScore: z.number().min(0).max(5),
  headScore: z.number().min(0).max(5), confidence: z.number().min(1).max(5), paraphrase: z.string().trim().min(1),
  comment: z.string(), submittedAt: z.string(),
});

export const jobSchema = z.object({
  id: z.string(), type: z.enum(["import", "validate", "export", "aggregate", "experiment", "analysis", "source_sync"]),
  title: z.string(), status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  progress: z.number().min(0).max(100), createdAt: z.string(), startedAt: z.string().optional(),
  finishedAt: z.string().optional(), payload: z.record(z.string(), z.unknown()), error: z.string().optional(),
});

export const runSchema = z.object({
  id: z.string(), model: z.string(), language: z.enum(["EN", "PT", "TR"]), context: z.string(),
  level: z.enum(["nc", "sentence", "contextual_span", "isolated_phrase"]),
  family: z.string().optional(), cohort: z.string().optional(),
  studyExperiment: z.number().int().min(1).max(4).optional(), year: z.number().int().optional(),
  trainingStage: z.enum(["base", "instruct"]).optional(), runtime: z.string().optional(),
  isc: z.number().optional(), ig: z.number().optional(), lod: z.number().optional(),
  aid: z.number().optional(), floor: z.number().optional(), rho: z.number().optional(),
  ics: z.number().optional(), idiomGap: z.number().optional(), compositionalGap: z.number().optional(),
  ordinaryGap: z.number().optional(), ocgIdiom: z.number().optional(),
  ocgCompositional: z.number().optional(), anisotropyWarning: z.boolean().optional(),
  status: z.enum(["imported", "completed", "failed"]),
});

export const projectSchema = z.object({
  id: z.string(), name: z.string(), language: z.enum(["TR", "EN", "PT"]), protocolVersion: z.string(),
  readOnly: z.boolean(), targetMweCount: z.number().int().positive(), targetSentenceCount: z.number().int().positive(),
  articleSource: z.string().optional(), primaryAnalysisLevel: z.enum(["contextual_span"]).optional(),
  requiredMetrics: z.array(z.string()).optional(),
});

export const researchSnapshotSchema = z.object({
  schemaVersion: z.number().int().positive(), generatedAt: z.string(), project: projectSchema,
  mwes: z.array(mweSchema), sources: z.array(sourceSchema), campaigns: z.array(campaignSchema),
  assignments: z.array(assignmentSchema), annotations: z.array(annotationSchema), jobs: z.array(jobSchema), runs: z.array(runSchema),
  ordinaryControlReviews: z.array(ordinaryControlReviewSchema),
});

export type ResearchSnapshot = z.infer<typeof researchSnapshotSchema>;
export type MweRecord = z.infer<typeof mweSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export type CampaignRecord = z.infer<typeof campaignSchema>;
export type AssignmentRecord = z.infer<typeof assignmentSchema>;
export type AnnotationRecord = z.infer<typeof annotationSchema>;
export type JobRecord = z.infer<typeof jobSchema>;
export type RunRecord = z.infer<typeof runSchema>;
export type ExtractedProbeCandidate = z.infer<typeof extractedProbeCandidateSchema>;
export type ProbeCandidateRecord = z.infer<typeof probeCandidateSchema>;
export type KenetCandidateItem = z.infer<typeof kenetCandidateItemSchema>;
export type KenetCandidateArtifact = z.infer<typeof kenetCandidateArtifactSchema>;
export type ProbeReviewRecord = z.infer<typeof probeReviewSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;
export type ExampleCandidate = z.infer<typeof exampleCandidateSchema>;
export type ExampleCandidateArtifact = z.infer<typeof exampleCandidateArtifactSchema>;
export type ExampleReviewRecord = z.infer<typeof exampleReviewSchema>;
export type RandomProbeCandidate = z.infer<typeof randomProbeCandidateSchema>;
export type RandomProbeCandidateArtifact = z.infer<typeof randomProbeCandidateArtifactSchema>;
export type AnnotationItemSnapshot = z.infer<typeof annotationItemSnapshotSchema>;
export type AnnotationPilotPlan = z.infer<typeof annotationPilotPlanSchema>;
export type AnnotationAggregate = z.infer<typeof annotationAggregateSchema>;
export type AggregationReport = z.infer<typeof aggregationReportSchema>;
export type ReferenceDatasetIndex = z.infer<typeof referenceDatasetIndexSchema>;
export type ReferenceDatasetLanguage = z.infer<typeof referenceDatasetLanguageSchema>;
export type ReferenceMweRecord = ReferenceDatasetLanguage["items"][number];
export type OrdinaryControlArtifact = z.infer<typeof ordinaryControlArtifactSchema>;
export type OrdinaryControlItem = z.infer<typeof ordinaryControlItemSchema>;
export type OrdinaryControlReview = z.infer<typeof ordinaryControlReviewSchema>;
