import {
  probeCandidateSchema,
  mweSchema,
  type ProbeCandidateRecord,
  type MweRecord,
} from "@/data/schema";
import { tx } from "@/i18n";


export function replaceTokenSpan(
  sentence: string,
  span: [number, number],
  replacement: string,
): { sentence: string; targetSurface: string; span: [number, number] } {
  const tokens = sentence.trim().split(/\s+/u);
  const [start, end] = span;
  if (start < 0 || end <= start || end > tokens.length) {
    throw new Error(tx("errors.invalidTargetSpan", { start, end }));
  }
  const replacementTokens = replacement.trim().split(/\s+/u);
  const leading = tokens[start].match(/^[^\p{L}\p{N}]*/u)?.[0] ?? "";
  const trailing = tokens[end - 1].match(/[^\p{L}\p{N}]*$/u)?.[0] ?? "";
  replacementTokens[0] = leading + replacementTokens[0];
  replacementTokens[replacementTokens.length - 1] += trailing;
  const nextTokens = [...tokens.slice(0, start), ...replacementTokens, ...tokens.slice(end)];
  return {
    sentence: nextTokens.join(" "),
    targetSurface: replacementTokens.join(" ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
    span: [start, start + replacementTokens.length],
  };
}

/** Pure transformation used after a curator accepts lexical/sense evidence. */
export function applyApprovedProbeCandidate(
  record: MweRecord,
  rawCandidate: ProbeCandidateRecord,
): MweRecord {
  const candidate = probeCandidateSchema.parse(rawCandidate);
  const probe = {
    ...candidate,
    reviewStatus: "approved" as const,
    senseReviewStatus: "approved_by_curator",
  };
  const variants = record.contexts.map((context) => {
    if (!context.span) throw new Error(tx("errors.contextMissingSpan", { contextId: context.id }));
    const replaced = replaceTokenSpan(context.sentence, context.span, candidate.lexicalForm);
    return {
      id: `${context.id}-${candidate.id}`,
      contextId: context.id,
      probeKind: candidate.kind,
      candidateId: candidate.id,
      sentence: replaced.sentence,
      targetSurface: replaced.targetSurface,
      span: replaced.span,
      grammarReviewStatus: "review_required" as const,
    };
  });
  return mweSchema.parse({
    ...record,
    probes: [...record.probes.filter((item) => item.id !== candidate.id), probe],
    variants: [...record.variants.filter((item) => item.candidateId !== candidate.id), ...variants],
  });
}
