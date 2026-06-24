import type { AnnotationRecord, AssignmentRecord } from "@/data/schema";

export interface BrowserAggregateItem {
  mweId: string;
  contextId: string | null;
  taskType: "type" | "token";
  n: number;
  mean: number;
  median: number;
  stdev: number;
  ci95Low: number;
  ci95High: number;
  modifierMean: number;
  headMean: number;
  confidenceMean: number;
  requiresAdjudication: boolean;
  paraphrases: string[];
}

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function stdev(values: number[]) { if (values.length < 2) return 0; const average = mean(values); return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)); }
function hashString(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function randomGenerator(seed: number) { let state = seed || 1; return () => { state |= 0; state = state + 0x6d2b79f5 | 0; let value = Math.imul(state ^ state >>> 15, 1 | state); value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value; return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }

function bootstrapCi(values: number[], seed: number): [number, number] {
  const random = randomGenerator(seed);
  const means = Array.from({ length: 2000 }, () => mean(Array.from({ length: values.length }, () => values[Math.floor(random() * values.length)]))).sort((a, b) => a - b);
  return [means[Math.floor(means.length * 0.025)], means[Math.floor(means.length * 0.975)]];
}

function krippendorffAlpha(groups: number[][]): number | null {
  const usable = groups.filter((group) => group.length >= 2);
  const all = usable.flat();
  if (!usable.length || new Set(all).size < 2) return null;
  const observed: number[] = [];
  for (const group of usable) for (let left = 0; left < group.length; left += 1) for (let right = left + 1; right < group.length; right += 1) observed.push((group[left] - group[right]) ** 2);
  const expected: number[] = [];
  for (let left = 0; left < all.length; left += 1) for (let right = left + 1; right < all.length; right += 1) expected.push((all[left] - all[right]) ** 2);
  const denominator = mean(expected);
  return denominator ? 1 - mean(observed) / denominator : null;
}

function iccOneWayAverage(groups: number[][]): number | null {
  const usable = groups.filter((group) => group.length >= 2);
  if (usable.length < 2) return null;
  const k = Math.min(...usable.map((group) => group.length));
  const trimmed = usable.map((group) => group.slice(0, k));
  const means = trimmed.map(mean);
  const grand = mean(means);
  const msBetween = k * means.reduce((sum, value) => sum + (value - grand) ** 2, 0) / (trimmed.length - 1);
  const msWithin = trimmed.reduce((sum, group, index) => sum + group.reduce((inner, value) => inner + (value - means[index]) ** 2, 0), 0) / (trimmed.length * (k - 1));
  const denominator = msBetween + (k - 1) * msWithin;
  return denominator ? (msBetween - msWithin) / denominator : null;
}

export function aggregateAcceptedAnnotations(annotations: AnnotationRecord[], assignments: AssignmentRecord[]) {
  const accepted = new Map(assignments.filter((assignment) => assignment.status === "accepted").map((assignment) => [assignment.id, assignment]));
  const groups = new Map<string, { assignment: AssignmentRecord; responses: AnnotationRecord[] }>();
  for (const response of annotations) {
    const assignment = accepted.get(response.assignmentId);
    if (!assignment) continue;
    const key = `${assignment.mweId}::${assignment.contextId ?? "TYPE"}`;
    const current = groups.get(key) ?? { assignment, responses: [] };
    current.responses.push(response);
    groups.set(key, current);
  }
  const items: BrowserAggregateItem[] = [];
  const scoreGroups: number[][] = [];
  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const scores = group.responses.map((response) => response.overallScore);
    const deviation = stdev(scores);
    const [ci95Low, ci95High] = bootstrapCi(scores, hashString(key));
    scoreGroups.push(scores);
    items.push({
      mweId: group.assignment.mweId,
      contextId: group.assignment.contextId ?? null,
      taskType: group.assignment.contextId == null ? "type" : "token",
      n: scores.length, mean: mean(scores), median: median(scores), stdev: deviation,
      ci95Low, ci95High,
      modifierMean: mean(group.responses.map((response) => response.modifierScore)),
      headMean: mean(group.responses.map((response) => response.headScore)),
      confidenceMean: mean(group.responses.map((response) => response.confidence)),
      requiresAdjudication: scores.length < 8 || deviation > 1.25,
      paraphrases: [...new Set(group.responses.map((response) => response.paraphrase.trim()).filter(Boolean))].sort(),
    });
  }
  return { items, ordinalKrippendorffAlpha: krippendorffAlpha(scoreGroups), iccOneWayAverage: iccOneWayAverage(scoreGroups) };
}
