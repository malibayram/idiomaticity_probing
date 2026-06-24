#!/usr/bin/env node

/** Seed the live curation project with Firebase CLI OAuth, without credentials on disk. */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const FIREBASE_TOOLS = process.env.FIREBASE_TOOLS_ROOT
  ?? "/Users/alibayram/.nvm/versions/node/v22.15.0/lib/node_modules/firebase-tools/lib";
const auth = require(`${FIREBASE_TOOLS}/auth.js`);
const scopes = require(`${FIREBASE_TOOLS}/scopes.js`);
const PROJECT_ID = "cross-lingual-mwe";
const ROOT = resolve(import.meta.dirname, "..");
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error("Firebase CLI oturumu bulunamadı.");
const { access_token: accessToken } = await auth.getAccessToken(account.tokens.refresh_token, [
  scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM,
]);

function value(input) {
  if (input === null || input === undefined) return { nullValue: null };
  if (typeof input === "string") return { stringValue: input };
  if (typeof input === "boolean") return { booleanValue: input };
  if (typeof input === "number") return Number.isInteger(input)
    ? { integerValue: String(input) } : { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  return { mapValue: { fields: fields(input) } };
}
function fields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, input]) => [key, value(input)]));
}
function name(path) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}
async function documentExists(path) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${name(path)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-goog-user-project": PROJECT_ID,
    },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Firestore get ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return true;
}
async function writeRows(rows) {
  for (let offset = 0; offset < rows.length; offset += 25) {
    const writes = rows.slice(offset, offset + 25).map(({ path, record }) => ({
      update: { name: name(path), fields: fields(record) },
    }));
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-goog-user-project": PROJECT_ID,
        },
        body: JSON.stringify({ writes }),
      },
    );
    if (!response.ok) throw new Error(`Firestore batchWrite ${response.status}: ${(await response.text()).slice(0, 500)}`);
    process.stdout.write(`\rLive curation seed: ${Math.min(offset + 25, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
}

const [seed, kenet, randomProbes, examples, annotationPlan] = await Promise.all([
  readJson("studio/public/seed/tr_project.json"),
  readJson("studio/public/candidates/kenet_probe_candidates.json"),
  readJson("studio/public/candidates/tatoeba_random_probe_candidates.json"),
  readJson("studio/public/candidates/tatoeba_example_candidates.json"),
  readJson("studio/public/annotation/tr_pilot_plan.json"),
]);
const projectId = seed.project.id;
const curationAlreadyExists = await documentExists(`projects/${projectId}`);
const project = {
  ...seed.project,
  schemaVersion: seed.schemaVersion,
  generatedAt: seed.generatedAt,
  seededAt: new Date().toISOString(),
  seededBy: account.user.email,
};
const rows = [];
if (!curationAlreadyExists) {
  rows.push({ path: `projects/${projectId}`, record: project });
  for (const item of seed.mwes) rows.push({ path: `projects/${projectId}/mwes/${item.id}`, record: item });
  for (const item of seed.sources) rows.push({ path: `sources/${item.id}`, record: item });
  for (const item of seed.campaigns) rows.push({ path: `campaigns/${item.id}`, record: item });
  for (const item of seed.jobs) rows.push({ path: `jobs/${item.id}`, record: item });
  for (const item of seed.runs) rows.push({ path: `runs/${item.id}`, record: item });
}

function addGroupedArtifact(id, artifactType, artifact, itemKey = "items") {
  const { [itemKey]: artifactItems, ...metadata } = artifact;
  rows.push({
    path: `candidateArtifacts/${id}`,
    record: { ...metadata, artifactType, itemCount: artifactItems.length, readOnly: true },
  });
  artifactItems.forEach((item, order) => rows.push({
    path: `candidateArtifacts/${id}/items/${item.mweId}`,
    record: { ...item, order },
  }));
}

addGroupedArtifact("tr-kenet-probes-v1", "kenet_probe_candidates", kenet);
addGroupedArtifact("tr-random-probes-v1", "random_probe_candidates", randomProbes);

const { candidates, ...exampleMetadata } = examples;
const candidatesByMwe = new Map();
for (const candidate of candidates) {
  const group = candidatesByMwe.get(candidate.mweId) ?? [];
  group.push(candidate);
  candidatesByMwe.set(candidate.mweId, group);
}
rows.push({
  path: "candidateArtifacts/tr-tatoeba-examples-v1",
  record: {
    ...exampleMetadata,
    artifactType: "tatoeba_example_candidates",
    itemCount: candidates.length,
    groupCount: candidatesByMwe.size,
    readOnly: true,
  },
});
[...candidatesByMwe.entries()].forEach(([mweId, groupedCandidates], order) => rows.push({
  path: `candidateArtifacts/tr-tatoeba-examples-v1/items/${mweId}`,
  record: { mweId, order, candidates: groupedCandidates },
}));

rows.push({
  path: "candidateArtifacts/tr-annotation-pilot-v1",
  record: { ...annotationPlan, artifactType: "annotation_pilot_plan", readOnly: true },
});
rows.push({
  path: `auditEvents/seed-cli-${Date.now()}`,
  record: {
    type: curationAlreadyExists ? "candidate_artifacts_seeded_via_cli" : "project_seeded_via_cli",
    actorUid: account.user.email,
    projectId,
    curationSeedWritten: !curationAlreadyExists,
    counts: { mwes: seed.mwes.length, sources: seed.sources.length, runs: seed.runs.length },
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  },
});
await writeRows(rows);
console.log(JSON.stringify({
  ok: true,
  projectId,
  curationAlreadyExists,
  curationSeedWritten: !curationAlreadyExists,
  mwes: seed.mwes.length,
  sources: seed.sources.length,
  campaigns: seed.campaigns.length,
  runs: seed.runs.length,
  candidateArtifacts: {
    kenetMwes: kenet.items.length,
    randomProbeMwes: randomProbes.items.length,
    exampleMwes: candidatesByMwe.size,
    examples: candidates.length,
    annotationPlan: true,
  },
}, null, 2));
