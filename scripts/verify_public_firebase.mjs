#!/usr/bin/env node

/** Authoritative completion audit for public Firebase data and App Check. */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const FIREBASE_TOOLS = process.env.FIREBASE_TOOLS_ROOT
  ?? "/Users/alibayram/.nvm/versions/node/v22.15.0/lib/node_modules/firebase-tools/lib";
const auth = require(`${FIREBASE_TOOLS}/auth.js`);
const scopes = require(`${FIREBASE_TOOLS}/scopes.js`);
const PROJECT_ID = "cross-lingual-mwe";
const PROJECT_NUMBER = "934969670856";
const APP_ID = "1:934969670856:web:f62bf4bf8acef7b75c79fd";
const RELEASE_ID = "ncimp-public-v1";
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error("Firebase CLI oturumu bulunamadı.");
const { access_token: accessToken } = await auth.getAccessToken(account.tokens.refresh_token, [
  scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM,
]);

async function api(url, { allow404 = false } = {}) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-goog-user-project": PROJECT_ID,
    },
  });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 400)}`);
  return response.json();
}

function decode(value) {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return Object.fromEntries(
    Object.entries(value.mapValue.fields ?? {}).map(([key, child]) => [key, decode(child)]),
  );
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decode);
  return null;
}

async function countLanguage(language) {
  return countCollection(`publications/${RELEASE_ID}/languages/${language}/items`);
}

async function countCollection(path) {
  let count = 0;
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await api(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${query}`,
    );
    count += (result.documents ?? []).length;
    pageToken = result.nextPageToken ?? "";
  } while (pageToken);
  return count;
}

async function verifyUnattestedReadBlocked() {
  const env = await readFile(resolve(import.meta.dirname, "../studio/.env.local"), "utf8");
  const apiKey = env.match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!apiKey) return { checked: false, blocked: false, status: null };
  const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!signUp.ok) return { checked: false, blocked: false, status: signUp.status };
  const { idToken } = await signUp.json();
  const read = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publications/${RELEASE_ID}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  return { checked: true, blocked: read.status === 401 || read.status === 403, status: read.status };
}

const release = await api(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publications/${RELEASE_ID}`,
);
const releaseFields = Object.fromEntries(
  Object.entries(release.fields ?? {}).map(([key, value]) => [key, decode(value)]),
);
const counts = Object.fromEntries(await Promise.all(
  ["TR", "EN", "PT", "CTRL"].map(async (language) => [language, await countLanguage(language)]),
));
const appCheckName = `projects/${PROJECT_NUMBER}/apps/${APP_ID}/recaptchaEnterpriseConfig`;
const appCheck = await api(`https://firebaseappcheck.googleapis.com/v1beta/${appCheckName}`);
const enforcement = await api(
  `https://firebaseappcheck.googleapis.com/v1beta/projects/${PROJECT_NUMBER}/services/firestore.googleapis.com`,
  { allow404: true },
);
const curation = await api(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/projects/tr-ncimp`,
  { allow404: true },
);
const artifactIds = {
  kenet: "tr-kenet-probes-v1",
  random: "tr-random-probes-v1",
  examples: "tr-tatoeba-examples-v1",
  annotationPlan: "tr-annotation-pilot-v1",
};
const artifactRoots = Object.fromEntries(await Promise.all(
  Object.entries(artifactIds).map(async ([key, id]) => [key, Boolean(await api(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/candidateArtifacts/${id}`,
    { allow404: true },
  ))]),
));
const artifactItemCounts = {
  kenet: await countCollection(`candidateArtifacts/${artifactIds.kenet}/items`),
  random: await countCollection(`candidateArtifacts/${artifactIds.random}/items`),
  examples: await countCollection(`candidateArtifacts/${artifactIds.examples}/items`),
};
const privatePaths = [
  "/seed/tr_project.json",
  "/references/ncimp_en_reference.json",
  "/references/ncimp_pt_reference.json",
  "/references/ncimp_en_pt_reference.csv",
  "/controls/turkish_ordinary_control.json",
  "/controls/turkish_ordinary_control.csv",
  "/candidates/kenet_probe_candidates.json",
  "/candidates/kenet_probe_candidates.csv",
  "/candidates/tatoeba_example_candidates.json",
  "/candidates/tatoeba_example_candidates.csv",
  "/candidates/tatoeba_random_probe_candidates.json",
  "/candidates/tatoeba_random_probe_candidates.csv",
  "/annotation/tr_pilot_plan.json",
  "/artifacts/datasets/tr-draft-current/TR.json",
];
const hosting = {};
for (const path of privatePaths) {
  const response = await fetch(`https://cross-lingual-mwe.web.app${path}`, { redirect: "follow" });
  hosting[path] = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    exposedRaw: (response.headers.get("content-type") ?? "").includes("json")
      || (response.headers.get("content-type") ?? "").includes("csv"),
  };
}

const unattestedRead = await verifyUnattestedReadBlocked();
const checks = {
  releaseSealed: releaseFields.status === "released" && releaseFields.readOnly === true,
  releaseCountsMatch: ["TR", "EN", "PT", "CTRL"].every(
    (language) => releaseFields.counts?.[language] === counts[language],
  ),
  appCheckConfigured: Boolean(appCheck.siteKey),
  firestoreEnforced: enforcement?.enforcementMode === "ENFORCED",
  unattestedReadBlocked: unattestedRead.checked && unattestedRead.blocked,
  liveCurationSeeded: Boolean(curation),
  candidateArtifactsPresent: Object.values(artifactRoots).every(Boolean)
    && artifactItemCounts.kenet === 280
    && artifactItemCounts.random === 280
    && artifactItemCounts.examples === 165,
  privateHostingArtifactsPruned: Object.values(hosting).every((item) => !item.exposedRaw),
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  ok,
  checks,
  release: {
    id: releaseFields.id,
    status: releaseFields.status,
    readOnly: releaseFields.readOnly,
    declaredCounts: releaseFields.counts,
    actualCounts: counts,
  },
  appCheck: {
    configured: Boolean(appCheck.siteKey),
    tokenTtl: appCheck.tokenTtl,
    firestoreEnforcement: enforcement?.enforcementMode ?? "UNCONFIGURED",
  },
  liveCurationSeeded: Boolean(curation),
  candidateArtifacts: { roots: artifactRoots, itemCounts: artifactItemCounts },
  unattestedRead,
  hosting,
}, null, 2));
if (process.argv.includes("--strict") && !ok) process.exitCode = 1;
