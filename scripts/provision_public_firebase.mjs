#!/usr/bin/env node

/**
 * Provision the immutable public Firestore snapshot and App Check web key.
 *
 * Uses the existing Firebase CLI OAuth session without printing credentials.
 * The returned reCAPTCHA Enterprise site key is public client configuration;
 * access/refresh tokens are never logged or written.
 */

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const FIREBASE_TOOLS = process.env.FIREBASE_TOOLS_ROOT
  ?? "/Users/alibayram/.nvm/versions/node/v22.15.0/lib/node_modules/firebase-tools/lib";
const auth = require(`${FIREBASE_TOOLS}/auth.js`);
const scopes = require(`${FIREBASE_TOOLS}/scopes.js`);

const ROOT = resolve(import.meta.dirname, "..");
const PROJECT_ID = "cross-lingual-mwe";
const PROJECT_NUMBER = "934969670856";
const APP_ID = "1:934969670856:web:f62bf4bf8acef7b75c79fd";
const RELEASE_ID = "ncimp-public-v1";
const RECAPTCHA_DISPLAY_NAME = "NCIMP Research Studio Web App Check";

const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) {
  throw new Error("Firebase CLI oturumu bulunamadı; önce firebase login çalıştırın.");
}
const tokenData = await auth.getAccessToken(account.tokens.refresh_token, [
  scopes.CLOUD_PLATFORM,
  scopes.FIREBASE_PLATFORM,
]);
const accessToken = tokenData.access_token;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": PROJECT_ID,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${new URL(url).pathname}: ${response.status} ${body?.error?.message ?? text.slice(0, 400)}`);
  }
  return body;
}

async function waitOperation(baseUrl, name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const operation = await api(`${baseUrl}/v1/${name}`);
    if (operation.done) {
      if (operation.error) throw new Error(operation.error.message ?? "API enable operation failed");
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  throw new Error(`Operation timeout: ${name}`);
}

async function enableService(service) {
  const base = "https://serviceusage.googleapis.com";
  const operation = await api(
    `${base}/v1/projects/${PROJECT_NUMBER}/services/${service}:enable`,
    { method: "POST", body: "{}" },
  );
  if (operation.name) await waitOperation(base, operation.name);
}

async function configureAppCheck() {
  await enableService("recaptchaenterprise.googleapis.com");
  await enableService("firebaseappcheck.googleapis.com");

  const keyList = await api(
    `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/keys?pageSize=100`,
  );
  let key = (keyList.keys ?? []).find((item) => item.displayName === RECAPTCHA_DISPLAY_NAME);
  if (!key) {
    key = await api(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/keys`,
      {
        method: "POST",
        body: JSON.stringify({
          displayName: RECAPTCHA_DISPLAY_NAME,
          webSettings: {
            allowAllDomains: false,
            allowedDomains: [
              "cross-lingual-mwe.web.app",
              "cross-lingual-mwe.firebaseapp.com",
            ],
            allowAmpTraffic: false,
            integrationType: "SCORE",
          },
        }),
      },
    );
  }
  const siteKey = key.name.split("/").at(-1);
  const configName = `projects/${PROJECT_NUMBER}/apps/${APP_ID}/recaptchaEnterpriseConfig`;
  await api(
    `https://firebaseappcheck.googleapis.com/v1beta/${configName}?updateMask=siteKey,tokenTtl`,
    {
      method: "PATCH",
      body: JSON.stringify({ name: configName, siteKey, tokenTtl: "3600s" }),
    },
  );
  return siteKey;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: firestoreFields(value) } };
  throw new Error(`Unsupported Firestore value: ${typeof value}`);
}

function firestoreFields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]));
}

function documentName(path) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function patchDocument(path, record) {
  await api(`https://firestore.googleapis.com/v1/${documentName(path)}`, {
    method: "PATCH",
    body: JSON.stringify({ name: documentName(path), fields: firestoreFields(record) }),
  });
}

async function batchWrite(rows) {
  const writes = rows.map(({ path, record }) => ({
    update: { name: documentName(path), fields: firestoreFields(record) },
  }));
  await api(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
    { method: "POST", body: JSON.stringify({ writes }) },
  );
}

async function writeInChunks(rows, size = 25) {
  for (let offset = 0; offset < rows.length; offset += size) {
    await batchWrite(rows.slice(offset, offset + size));
    process.stdout.write(`\rFirestore public snapshot: ${Math.min(offset + size, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
}

async function seedPublicSnapshot() {
  const [tr, en, pt, controls] = await Promise.all([
    readJson("studio/public/seed/tr_project.json"),
    readJson("studio/public/references/ncimp_en_reference.json"),
    readJson("studio/public/references/ncimp_pt_reference.json"),
    readJson("studio/public/controls/turkish_ordinary_control.json"),
  ]);
  const groups = {
    TR: tr.mwes,
    EN: en.items,
    PT: pt.items,
    CTRL: controls.items,
  };
  const counts = Object.fromEntries(Object.entries(groups).map(([language, items]) => [language, items.length]));
  const generatedAt = new Date().toISOString();
  await patchDocument(`publications/${RELEASE_ID}`, {
    id: RELEASE_ID,
    title: "NCIMP public read-only research snapshot",
    protocolVersion: tr.project.protocolVersion,
    status: "draft",
    readOnly: true,
    schemaVersion: 1,
    counts,
    generatedAt,
    createdBy: account.user.email,
  });

  const rows = [];
  for (const [language, items] of Object.entries(groups)) {
    rows.push({
      path: `publications/${RELEASE_ID}/languages/${language}`,
      record: { id: language, language, itemCount: items.length, readOnly: true, schemaVersion: 1 },
    });
    for (const item of items) {
      const id = item.item_id ?? item.id;
      rows.push({
        path: `publications/${RELEASE_ID}/languages/${language}/items/${id}`,
        record: item,
      });
    }
  }
  await writeInChunks(rows);
  await patchDocument(`publications/${RELEASE_ID}`, {
    id: RELEASE_ID,
    title: "NCIMP public read-only research snapshot",
    protocolVersion: tr.project.protocolVersion,
    status: "released",
    readOnly: true,
    schemaVersion: 1,
    counts,
    generatedAt,
    createdBy: account.user.email,
    releasedAt: new Date().toISOString(),
  });
  return counts;
}

const [siteKey, counts] = await Promise.all([
  configureAppCheck(),
  seedPublicSnapshot(),
]);

console.log(JSON.stringify({
  ok: true,
  publicRelease: RELEASE_ID,
  counts,
  appCheckSiteKey: siteKey,
  allowedDomains: ["cross-lingual-mwe.web.app", "cross-lingual-mwe.firebaseapp.com"],
}, null, 2));
