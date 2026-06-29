import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { researchSnapshotSchema } from "../src/data/schema";
import type { MweRecord } from "../src/data/schema";
import {
  computeMweParity,
  computeParitySummary,
  EN_REFERENCE_ITEM_COUNT,
} from "../src/data/english-parity";

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

/** Minimal MWE with only the fields the parity util reads. */
function mwe(partial: {
  id: string;
  canonicalForm: string;
  goldScore?: number | null;
  variantKinds?: string[];
}): MweRecord {
  return {
    id: partial.id,
    canonicalForm: partial.canonicalForm,
    goldScore: partial.goldScore ?? null,
    variants: (partial.variantKinds ?? []).map((kind, index) => ({
      probeKind: kind,
      id: `${partial.id}-v${index}`,
    })),
  } as unknown as MweRecord;
}

describe("computeMweParity", () => {
  test("counts probe families and gold as the five dimensions", () => {
    const parity = computeMweParity(
      mwe({
        id: "X-1",
        canonicalForm: "kara liste",
        goldScore: 2.4,
        variantKinds: ["P_Comp", "P_Comp", "P_Syn"],
      }),
    );
    expect(parity.total).toBe(5);
    expect(parity.filled).toBe(3); // P_Comp, P_Syn, gold
    expect(parity.pct).toBe(60);
    expect(parity.variantCounts.P_Comp).toBe(2);
    expect(parity.families.P_WordsSyn).toBe(false);
    expect(parity.missing).toEqual(["P_WordsSyn", "P_Rand"]);
  });

  test("an item with nothing produced is 0% and lists every dimension", () => {
    const parity = computeMweParity(mwe({ id: "X-2", canonicalForm: "acı reçete" }));
    expect(parity.pct).toBe(0);
    expect(parity.missing).toEqual(["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand", "gold"]);
  });

  test("a fully produced item is 100% with no to-do", () => {
    const parity = computeMweParity(
      mwe({
        id: "X-3",
        canonicalForm: "tam",
        goldScore: 4,
        variantKinds: ["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand"],
      }),
    );
    expect(parity.pct).toBe(100);
    expect(parity.missing).toEqual([]);
  });
});

describe("computeParitySummary on the bundled TR seed", () => {
  const snapshot = researchSnapshotSchema.parse(
    readJson("public/seed/tr_project.json"),
  );
  const summary = computeParitySummary(snapshot.mwes);

  test("reflects the current state: only P_Comp produced, no gold yet", () => {
    expect(summary.itemCount).toBe(280);
    expect(summary.referenceCount).toBe(EN_REFERENCE_ITEM_COUNT);
    expect(summary.dimensionCoverage.P_Comp).toBe(280);
    expect(summary.dimensionCoverage.P_Syn).toBe(0);
    expect(summary.dimensionCoverage.P_WordsSyn).toBe(0);
    expect(summary.dimensionCoverage.P_Rand).toBe(0);
    expect(summary.dimensionCoverage.gold).toBe(0);
    expect(summary.avgPct).toBe(20); // 1 of 5 dimensions on average
    expect(summary.completeCount).toBe(0);
  });
});
