#!/usr/bin/env node

/** Enable Firestore App Check only after a valid-token live read is verified. */
import { createRequire } from "node:module";

if (process.argv[2] !== "--enforce-firestore") {
  throw new Error("Refusing to change enforcement without --enforce-firestore.");
}
const require = createRequire(import.meta.url);
const FIREBASE_TOOLS = process.env.FIREBASE_TOOLS_ROOT
  ?? "/Users/alibayram/.nvm/versions/node/v22.15.0/lib/node_modules/firebase-tools/lib";
const auth = require(`${FIREBASE_TOOLS}/auth.js`);
const scopes = require(`${FIREBASE_TOOLS}/scopes.js`);
const PROJECT_ID = "cross-lingual-mwe";
const PROJECT_NUMBER = "934969670856";
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error("Firebase CLI oturumu bulunamadı.");
const { access_token: accessToken } = await auth.getAccessToken(account.tokens.refresh_token, [
  scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM,
]);
const name = `projects/${PROJECT_NUMBER}/services/firestore.googleapis.com`;
const response = await fetch(
  `https://firebaseappcheck.googleapis.com/v1beta/${name}?updateMask=enforcementMode`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": PROJECT_ID,
    },
    body: JSON.stringify({ name, enforcementMode: "ENFORCED" }),
  },
);
if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 500)}`);
const result = await response.json();
console.log(JSON.stringify({ service: result.name, enforcementMode: result.enforcementMode }, null, 2));
