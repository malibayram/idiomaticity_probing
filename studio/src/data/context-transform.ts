import {
  exampleCandidateSchema,
  mweSchema,
  type ExampleCandidate,
  type MweRecord,
} from "@/data/schema";
import { replaceTokenSpan } from "@/data/probe-transform";
import { tx } from "@/i18n";


export type NaturalContextSlot = "S1" | "S2" | "S3";

function normalizeToken(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("tr-TR")
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
}

export function locateTokenSpan(sentence: string, surface: string): [number, number] | null {
  const sentenceTokens = sentence.trim().split(/\s+/u);
  const targetTokens = surface.trim().split(/\s+/u);
  const normalizedSentence = sentenceTokens.map(normalizeToken);
  const normalizedTarget = targetTokens.map(normalizeToken);
  for (let start = 0; start <= normalizedSentence.length - normalizedTarget.length; start += 1) {
    if (normalizedTarget.every((token, offset) => normalizedSentence[start + offset] === token)) {
      return [start, start + normalizedTarget.length];
    }
  }
  return null;
}

/** Replace one natural context and invalidate/regenerate its probe variants. */
export function applyApprovedExampleCandidate(
  record: MweRecord,
  rawCandidate: ExampleCandidate,
  targetSlot: NaturalContextSlot,
): MweRecord {
  const candidate = exampleCandidateSchema.parse(rawCandidate);
  if (candidate.mweId !== record.id) throw new Error(tx("errors.exampleCandidateMismatch"));
  const span = locateTokenSpan(candidate.sentence, candidate.targetSurface);
  if (!span) throw new Error(tx("errors.exampleCandidateSpanNotFound"));

  const targetContext = record.contexts.find((context) => context.slot === targetSlot);
  if (!targetContext) throw new Error(tx("errors.exampleSlotNotFound", { slot: targetSlot }));
  const nextContext = {
    ...targetContext,
    sentence: candidate.sentence,
    targetSurface: candidate.targetSurface,
    span,
    provenance: {
      origin: "internet_open_license" as const,
      sourceId: candidate.sourceId,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      author: candidate.author,
      license: candidate.license,
      licenseReviewStatus: candidate.licenseReviewStatus,
      senseReviewStatus: "approved_by_curator",
    },
    reviewStatus: "approved" as const,
  };

  const nextVariants = record.probes.map((probe) => {
    const replaced = replaceTokenSpan(candidate.sentence, span, probe.lexicalForm);
    return {
      id: `${nextContext.id}-${probe.id}`,
      contextId: nextContext.id,
      probeKind: probe.kind,
      candidateId: probe.id,
      sentence: replaced.sentence,
      targetSurface: replaced.targetSurface,
      span: replaced.span,
      grammarReviewStatus: "review_required" as const,
    };
  });
  const contexts = record.contexts.map((context) => context.id === nextContext.id ? nextContext : context);
  const naturalContexts = contexts.filter((context) => context.family === "naturalistic");
  const examplesReady = naturalContexts.every((context) => context.reviewStatus === "approved")
    && naturalContexts.some((context) => context.provenance.origin === "internet_open_license");

  return mweSchema.parse({
    ...record,
    contexts,
    variants: [
      ...record.variants.filter((variant) => variant.contextId !== nextContext.id),
      ...nextVariants,
    ],
    workflowStatus: record.workflowStatus === "draft" && examplesReady ? "examples_ready" : record.workflowStatus,
  });
}
