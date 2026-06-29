import type { MweRecord } from "@/data/schema";

/**
 * "Closeness to the English version" for each MWE.
 *
 * The English NCIMP reference ships, per item, probe sentences for four probe
 * families and a human gold score. The Turkish replication is measured against
 * that same target: a dimension counts as satisfied when the Turkish item has
 * produced the equivalent artifact.
 *
 *  - Probe family satisfied  -> at least one probe *variant* (a generated probe
 *    sentence) of that family exists. Candidate components (`probes`) are inputs,
 *    not the finished artifact, so they do not count on their own.
 *  - Gold satisfied          -> a human gold score has been adjudicated.
 */

export const PROBE_FAMILIES = [
  "P_Syn",
  "P_Comp",
  "P_WordsSyn",
  "P_Rand",
] as const;
export type ProbeFamily = (typeof PROBE_FAMILIES)[number];

export type ParityDimension = ProbeFamily | "gold";
export const PARITY_DIMENSIONS: ParityDimension[] = [...PROBE_FAMILIES, "gold"];

/** Item count of the English reference dataset, shown for context. */
export const EN_REFERENCE_ITEM_COUNT = 281;

export interface MweParity {
  id: string;
  canonicalForm: string;
  /** Whether each probe family has at least one produced variant. */
  families: Record<ProbeFamily, boolean>;
  /** Number of produced variants per family (for richer display). */
  variantCounts: Record<ProbeFamily, number>;
  /** Whether a human gold score has been adjudicated. */
  gold: boolean;
  /** Satisfied dimensions (0..total). */
  filled: number;
  /** Total dimensions measured (probe families + gold). */
  total: number;
  /** Closeness percentage, 0..100. */
  pct: number;
  /** Dimensions still missing, i.e. the per-item to-do list. */
  missing: ParityDimension[];
}

export function computeMweParity(mwe: MweRecord): MweParity {
  const variantCounts = Object.fromEntries(
    PROBE_FAMILIES.map((family) => [family, 0]),
  ) as Record<ProbeFamily, number>;
  for (const variant of mwe.variants ?? []) {
    if (variant.probeKind in variantCounts) {
      variantCounts[variant.probeKind as ProbeFamily] += 1;
    }
  }
  const families = Object.fromEntries(
    PROBE_FAMILIES.map((family) => [family, variantCounts[family] > 0]),
  ) as Record<ProbeFamily, boolean>;
  const gold = mwe.goldScore != null;

  const missing: ParityDimension[] = [
    ...PROBE_FAMILIES.filter((family) => !families[family]),
    ...(gold ? [] : (["gold"] as ParityDimension[])),
  ];
  const total = PARITY_DIMENSIONS.length;
  const filled = total - missing.length;

  return {
    id: mwe.id,
    canonicalForm: mwe.canonicalForm,
    families,
    variantCounts,
    gold,
    filled,
    total,
    pct: total > 0 ? Math.round((filled / total) * 100) : 0,
    missing,
  };
}

export interface ParitySummary {
  /** Number of Turkish items measured. */
  itemCount: number;
  /** English reference item count, for the "x / y items" note. */
  referenceCount: number;
  /** Mean closeness across all items, 0..100. */
  avgPct: number;
  /** Items satisfying every dimension. */
  completeCount: number;
  /** How many items satisfy each dimension. */
  dimensionCoverage: Record<ParityDimension, number>;
  /** Per-item parity, in input order. */
  items: MweParity[];
}

export function computeParitySummary(
  mwes: MweRecord[],
  referenceCount: number = EN_REFERENCE_ITEM_COUNT,
): ParitySummary {
  const items = mwes.map(computeMweParity);
  const dimensionCoverage = Object.fromEntries(
    PARITY_DIMENSIONS.map((dimension) => [dimension, 0]),
  ) as Record<ParityDimension, number>;

  let pctSum = 0;
  let completeCount = 0;
  for (const item of items) {
    pctSum += item.pct;
    if (item.missing.length === 0) completeCount += 1;
    for (const family of PROBE_FAMILIES) {
      if (item.families[family]) dimensionCoverage[family] += 1;
    }
    if (item.gold) dimensionCoverage.gold += 1;
  }

  return {
    itemCount: items.length,
    referenceCount,
    avgPct: items.length ? Math.round(pctSum / items.length) : 0,
    completeCount,
    dimensionCoverage,
    items,
  };
}
