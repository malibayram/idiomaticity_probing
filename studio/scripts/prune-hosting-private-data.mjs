#!/usr/bin/env node

/**
 * Full example records are read from authenticated Firestore publications.
 * Keep source artifacts in studio/public for local curation, but never copy
 * these raw files into the production Hosting release.
 */
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
const privateHostingArtifacts = [
  "seed/tr_project.json",
  "references/ncimp_en_reference.json",
  "references/ncimp_pt_reference.json",
  "references/ncimp_en_pt_reference.csv",
  "controls/turkish_ordinary_control.json",
  "controls/turkish_ordinary_control.csv",
  "artifacts/datasets/tr-draft-current/TR.json",
  "candidates/kenet_probe_candidates.json",
  "candidates/kenet_probe_candidates.csv",
  "candidates/tatoeba_example_candidates.json",
  "candidates/tatoeba_example_candidates.csv",
  "candidates/tatoeba_random_probe_candidates.json",
  "candidates/tatoeba_random_probe_candidates.csv",
  "annotation/tr_pilot_plan.json",
];

for (const path of privateHostingArtifacts) {
  await rm(resolve(dist, path), { force: true });
}
console.log(`Pruned ${privateHostingArtifacts.length} authenticated-data artifacts from dist.`);
