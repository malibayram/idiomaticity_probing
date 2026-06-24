import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";


const PROJECT_ID = "demo-cross-lingual-mwe";
let env: RulesTestEnvironment;

const profile = (uid: string, role: string) => ({
  uid,
  email: `${uid}@example.test`,
  displayName: uid,
  photoURL: null,
  role,
  schemaVersion: 1,
  createdAt: "2026-06-23T00:00:00Z",
  updatedAt: "2026-06-23T00:00:00Z",
});

async function seedBaseData() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users/admin"), profile("admin", "admin")),
      setDoc(doc(db, "users/curator"), profile("curator", "curator")),
      setDoc(doc(db, "users/annotator"), profile("annotator", "annotator")),
      setDoc(doc(db, "users/other"), profile("other", "annotator")),
      setDoc(doc(db, "users/viewer"), profile("viewer", "viewer")),
      setDoc(doc(db, "users/pending"), profile("pending", "pending")),
      setDoc(doc(db, "projects/tr-ncimp"), {
        id: "tr-ncimp", language: "TR", readOnly: false, schemaVersion: 1,
      }),
      setDoc(doc(db, "projects/tr-ncimp/mwes/TR-NC-001"), {
        id: "TR-NC-001", projectId: "tr-ncimp", revision: 1,
      }),
      setDoc(doc(db, "assignments/a-own"), {
        id: "a-own", campaignId: "pilot-token", assigneeId: "annotator",
        mweId: "TR-NC-001", contextId: "TR-NC-001-S1", status: "assigned",
        itemSnapshotHash: "hash-1",
      }),
      setDoc(doc(db, "assignments/a-other"), {
        id: "a-other", campaignId: "pilot-token", assigneeId: "other",
        mweId: "TR-NC-001", contextId: "TR-NC-001-S2", status: "assigned",
        itemSnapshotHash: "hash-2",
      }),
      setDoc(doc(db, "annotations/locked"), {
        id: "locked", assignmentId: "a-other", campaignId: "pilot-token",
        annotatorId: "other", mweId: "TR-NC-001", contextId: "TR-NC-001-S2",
        overallScore: 1, modifierScore: 1, headScore: 1, confidence: 4,
        paraphrase: "parafraz", comment: "", submittedAt: "2026-06-23T00:00:00Z",
      }),
      setDoc(doc(db, "datasetVersions/released-v1"), {
        id: "released-v1", status: "released",
      }),
      setDoc(doc(db, "candidateArtifacts/tr-kenet-probes-v1"), {
        artifactType: "kenet_probe_candidates", readOnly: true,
      }),
      setDoc(doc(db, "candidateArtifacts/tr-kenet-probes-v1/items/TR-NC-001"), {
        mweId: "TR-NC-001", candidates: [],
      }),
    ]);
  });
}

function dbFor(uid?: string, token: Record<string, unknown> = {}) {
  return uid ? env.authenticatedContext(uid, token).firestore() : env.unauthenticatedContext().firestore();
}

function annotation(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-own", assignmentId: "a-own", campaignId: "pilot-token",
    annotatorId: "annotator", mweId: "TR-NC-001", contextId: "TR-NC-001-S1",
    overallScore: 2, modifierScore: 2, headScore: 3, confidence: 4,
    paraphrase: "sert önlem", comment: "", submittedAt: "2026-06-23T00:00:00Z",
    ...overrides,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve("firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedBaseData();
});

afterAll(async () => {
  await env.cleanup();
});

describe("authentication and roles", () => {
  test("unauthenticated and pending users cannot read research data", async () => {
    await assertFails(getDoc(doc(dbFor(), "projects/tr-ncimp")));
    await assertFails(getDoc(doc(dbFor("pending"), "projects/tr-ncimp")));
    await assertSucceeds(getDoc(doc(dbFor("viewer"), "projects/tr-ncimp")));
  });

  test("first login can create pending profile but cannot self-assign admin", async () => {
    const db = dbFor("new-user", { email: "new@example.test", email_verified: true });
    await assertSucceeds(setDoc(doc(db, "users/new-user"), profile("new-user", "pending")));
    const attacker = dbFor("attacker", { email: "attacker@example.test", email_verified: true });
    await assertFails(setDoc(doc(attacker, "users/attacker"), profile("attacker", "admin")));
  });

  test("verified configured bootstrap account can create its initial admin profile", async () => {
    const db = dbFor("bootstrap", {
      email: "malibayram20@gmail.com",
      email_verified: true,
    });
    await assertSucceeds(setDoc(doc(db, "users/bootstrap"), {
      ...profile("bootstrap", "admin"),
      email: "malibayram20@gmail.com",
    }));
  });

  test("ordinary users cannot change their role", async () => {
    await assertFails(updateDoc(doc(dbFor("viewer"), "users/viewer"), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(dbFor("viewer"), "users/viewer"), {
      displayName: "Yeni ad", updatedAt: "2026-06-23T01:00:00Z",
    }));
  });

  test("only curators and admins may write project curation data", async () => {
    await assertFails(updateDoc(doc(dbFor("annotator"), "projects/tr-ncimp/mwes/TR-NC-001"), { revision: 2 }));
    await assertSucceeds(updateDoc(doc(dbFor("curator"), "projects/tr-ncimp/mwes/TR-NC-001"), { revision: 2 }));
  });
});

describe("blind annotation workflow", () => {
  test("annotators see only their own assignment while curators see all", async () => {
    await assertSucceeds(getDoc(doc(dbFor("annotator"), "assignments/a-own")));
    await assertFails(getDoc(doc(dbFor("annotator"), "assignments/a-other")));
    await assertSucceeds(getDoc(doc(dbFor("curator"), "assignments/a-other")));
  });

  test("valid annotation and submitted assignment update succeed atomically", async () => {
    const db = dbFor("annotator");
    const batch = writeBatch(db);
    batch.set(doc(db, "annotations/a-own"), annotation());
    batch.update(doc(db, "assignments/a-own"), {
      status: "submitted", submittedAt: "2026-06-23T00:00:00Z",
    });
    await assertSucceeds(batch.commit());
  });

  test("an assignment cannot be submitted without its immutable response", async () => {
    await assertFails(updateDoc(doc(dbFor("annotator"), "assignments/a-own"), {
      status: "submitted", submittedAt: "2026-06-23T00:00:00Z",
    }));
    await assertSucceeds(updateDoc(doc(dbFor("annotator"), "assignments/a-own"), {
      status: "in_progress", startedAt: "2026-06-23T00:00:00Z",
    }));
  });

  test("assignment ownership, item snapshot join and score bounds are enforced", async () => {
    const db = dbFor("annotator");
    await assertFails(setDoc(doc(db, "annotations/duplicate-id"), annotation()));
    await assertFails(setDoc(doc(db, "annotations/a-other"), annotation({
      id: "a-other", assignmentId: "a-other", contextId: "TR-NC-001-S2",
    })));
    await assertFails(setDoc(doc(db, "annotations/a-own"), annotation({
      contextId: "TR-NC-001-S3",
    })));
    await assertFails(setDoc(doc(db, "annotations/a-own"), annotation({
      overallScore: 6,
    })));
    await assertFails(setDoc(doc(db, "annotations/a-own"), annotation({
      paraphrase: "",
    })));
  });

  test("submitted annotations remain immutable even for curators", async () => {
    await assertFails(updateDoc(doc(dbFor("curator"), "annotations/locked"), { overallScore: 5 }));
    await assertFails(deleteDoc(doc(dbFor("admin"), "annotations/locked")));
  });
});

describe("release, review and audit safety", () => {
  test("anonymous sessions can read but cannot write public releases", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "publications/ncimp-public-v1"), { status: "released", readOnly: true });
      await setDoc(doc(db, "publications/ncimp-public-v1/languages/EN/items/EN-001"), { id: "EN-001" });
    });
    const anonymous = dbFor("anonymous-reader", { firebase: { sign_in_provider: "anonymous" } });
    await assertFails(getDoc(doc(dbFor(), "publications/ncimp-public-v1")));
    await assertSucceeds(getDoc(doc(anonymous, "publications/ncimp-public-v1")));
    await assertSucceeds(getDoc(doc(anonymous, "publications/ncimp-public-v1/languages/EN/items/EN-001")));
    await assertFails(setDoc(doc(anonymous, "publications/ncimp-public-v1/languages/EN/items/attack"), { id: "attack" }));
  });

  test("curators can build a draft public release but released snapshots are immutable", async () => {
    const curator = dbFor("curator");
    await assertSucceeds(setDoc(doc(curator, "publications/draft-v1"), { status: "draft", readOnly: true }));
    await assertSucceeds(setDoc(doc(curator, "publications/draft-v1/languages/TR/items/TR-001"), { id: "TR-001" }));
    await assertSucceeds(updateDoc(doc(curator, "publications/draft-v1"), { status: "released" }));
    await assertFails(updateDoc(doc(curator, "publications/draft-v1"), { status: "draft" }));
    await assertFails(setDoc(doc(curator, "publications/draft-v1/languages/TR/items/TR-002"), { id: "TR-002" }));
  });

  test("released dataset versions cannot be changed or deleted", async () => {
    await assertFails(updateDoc(doc(dbFor("curator"), "datasetVersions/released-v1"), { status: "draft" }));
    await assertFails(deleteDoc(doc(dbFor("admin"), "datasetVersions/released-v1")));
  });

  test("probe reviews require curator role and reviewer identity", async () => {
    const review = {
      id: "candidate-1", projectId: "tr-ncimp", candidateId: "candidate-1",
      mweId: "TR-NC-001", status: "approved", notes: "uygun",
      reviewerUid: "curator", reviewedAt: "2026-06-23T00:00:00Z",
    };
    await assertFails(setDoc(doc(dbFor("annotator"), "probeReviews/candidate-1"), {
      ...review, reviewerUid: "annotator",
    }));
    await assertFails(setDoc(doc(dbFor("curator"), "probeReviews/candidate-1"), {
      ...review, reviewerUid: "someone-else",
    }));
    await assertSucceeds(setDoc(doc(dbFor("curator"), "probeReviews/candidate-1"), review));
  });

  test("example reviews require curator identity and a valid natural slot", async () => {
    const review = {
      id: "example-1", projectId: "tr-ncimp", candidateId: "example-1",
      mweId: "TR-NC-001", status: "approved", targetSlot: "S1", notes: "uygun",
      reviewerUid: "curator", reviewedAt: "2026-06-23T00:00:00Z",
    };
    await assertFails(setDoc(doc(dbFor("annotator"), "exampleReviews/example-1"), {
      ...review, reviewerUid: "annotator",
    }));
    await assertFails(setDoc(doc(dbFor("curator"), "exampleReviews/example-1"), {
      ...review, targetSlot: "N1",
    }));
    await assertSucceeds(setDoc(doc(dbFor("curator"), "exampleReviews/example-1"), review));
  });

  test("ordinary-control reviews require curator identity and stable item id", async () => {
    const review = {
      id: "TR-CTRL-001", projectId: "tr-ncimp", itemId: "TR-CTRL-001",
      status: "approved", notes: "kontrol edildi", reviewerUid: "curator",
      reviewedAt: "2026-06-23T00:00:00Z",
    };
    await assertFails(setDoc(doc(dbFor("annotator"), "ordinaryControlReviews/TR-CTRL-001"), {
      ...review, reviewerUid: "annotator",
    }));
    await assertFails(setDoc(doc(dbFor("curator"), "ordinaryControlReviews/TR-CTRL-001"), {
      ...review, itemId: "TR-CTRL-002",
    }));
    await assertSucceeds(setDoc(doc(dbFor("curator"), "ordinaryControlReviews/TR-CTRL-001"), review));
    await assertSucceeds(getDoc(doc(dbFor("viewer"), "ordinaryControlReviews/TR-CTRL-001")));
  });

  test("validation summaries are readable but only admin-writable from clients", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "validationReports/tr-ncimp"), { releaseReady: false });
    });
    await assertSucceeds(getDoc(doc(dbFor("viewer"), "validationReports/tr-ncimp")));
    await assertFails(updateDoc(doc(dbFor("curator"), "validationReports/tr-ncimp"), { releaseReady: true }));
    await assertSucceeds(updateDoc(doc(dbFor("admin"), "validationReports/tr-ncimp"), { releaseReady: false }));
  });

  test("candidate source pools are visible only to curators and admin-writable", async () => {
    const anonymous = dbFor("anonymous-reader", { firebase: { sign_in_provider: "anonymous" } });
    const rootPath = "candidateArtifacts/tr-kenet-probes-v1";
    const itemPath = `${rootPath}/items/TR-NC-001`;
    await assertFails(getDoc(doc(dbFor(), rootPath)));
    await assertFails(getDoc(doc(anonymous, rootPath)));
    await assertFails(getDoc(doc(dbFor("viewer"), rootPath)));
    await assertFails(getDoc(doc(dbFor("annotator"), itemPath)));
    await assertSucceeds(getDoc(doc(dbFor("curator"), rootPath)));
    await assertSucceeds(getDoc(doc(dbFor("curator"), itemPath)));
    await assertFails(updateDoc(doc(dbFor("curator"), rootPath), { readOnly: false }));
    await assertSucceeds(updateDoc(doc(dbFor("admin"), rootPath), { readOnly: true }));
  });

  test("annotation aggregates are curator-readable and admin-writable only", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "annotationAggregates/type-1"), {
        id: "type-1", projectId: "tr-ncimp", mweId: "TR-NC-001",
      });
    });
    await assertFails(getDoc(doc(dbFor("viewer"), "annotationAggregates/type-1")));
    await assertSucceeds(getDoc(doc(dbFor("curator"), "annotationAggregates/type-1")));
    await assertFails(updateDoc(doc(dbFor("curator"), "annotationAggregates/type-1"), { n: 8 }));
    await assertSucceeds(updateDoc(doc(dbFor("admin"), "annotationAggregates/type-1"), { n: 8 }));
  });

  test("curators can accept a submitted assignment while annotators cannot", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "assignments/a-own"), { status: "submitted" });
    });
    await assertFails(updateDoc(doc(dbFor("annotator"), "assignments/a-own"), { status: "accepted" }));
    await assertSucceeds(updateDoc(doc(dbFor("curator"), "assignments/a-own"), {
      status: "accepted", reviewedBy: "curator",
    }));
  });

  test("audit authors cannot impersonate another actor", async () => {
    await assertFails(setDoc(doc(dbFor("curator"), "auditEvents/bad"), {
      type: "test", actorUid: "admin",
    }));
    await assertSucceeds(setDoc(doc(dbFor("curator"), "auditEvents/good"), {
      type: "test", actorUid: "curator",
    }));
  });
});
