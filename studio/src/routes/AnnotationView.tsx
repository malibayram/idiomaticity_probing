import { useAuth } from "@/auth/AuthProvider";
import { SpanText } from "@/components/SpanText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import {
    useAggregationReport,
    useAnnotationAggregates,
    useAnnotationPilotPlan,
    useResearchSnapshot,
} from "@/data/hooks";
import {
    adjudicateMwe,
    aggregateAnnotationsNow,
    ensureMyPreAnnotationTasks,
    ensureMyTypeTasks,
    loadJobTemplate,
    queueJob,
    reviewAssignment,
    seedResearchProject,
    startAssignment,
    submitAnnotation,
} from "@/data/repository";
import type {
    AnnotationAggregate,
    AssignmentRecord,
} from "@/data/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const ALPHA_THRESHOLD = 0.67;

export function AnnotationView() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const snapshotQuery = useResearchSnapshot();
  const planQuery = useAnnotationPilotPlan();
  const aggregateQuery = useAnnotationAggregates();
  const reportQuery = useAggregationReport();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const provisionedRef = useRef<string | null>(null);

  const data = snapshotQuery.data;
  const snapshot = data?.snapshot;
  const privileged = profile?.role === "admin" || profile?.role === "curator";

  const ownAssignments = useMemo(
    () =>
      (snapshot?.assignments ?? []).filter(
        (item) => item.assigneeId === profile?.uid,
      ),
    [snapshot?.assignments, profile?.uid],
  );
  const selected =
    ownAssignments.find((item) => item.id === selectedId) ?? null;
  const submittedForReview = useMemo(
    () =>
      (snapshot?.assignments ?? []).filter(
        (item) =>
          item.status === "submitted" &&
          !item.campaignId.startsWith("tr-prelabel-"),
      ),
    [snapshot?.assignments],
  );
  const annotationByAssignment = useMemo(
    () =>
      new Map(
        (snapshot?.annotations ?? []).map((item) => [item.assignmentId, item]),
      ),
    [snapshot?.annotations],
  );

  const plan = planQuery.data;
  const hasTypeTask = ownAssignments.some(
    (item) => item.itemSnapshot.taskType === "type",
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] });
    await queryClient.invalidateQueries({
      queryKey: ["annotation-aggregates"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["annotation-aggregation-report"],
    });
    await snapshotQuery.refetch();
  }

  async function runAction(
    key: string,
    action: () => Promise<void>,
    success: string,
  ) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (reason) {
      setError(errorText(reason, t));
    } finally {
      setBusy(null);
    }
  }

  // Self-provision the current user's tasks once, replacing the manual
  // campaign-launch step. Runs only against a live Firestore project, at most
  // once per user, and only when they have no type task yet.
  useEffect(() => {
    if (data?.origin !== "firestore" || !plan || !profile?.uid) return;
    if (hasTypeTask || provisionedRef.current === profile.uid) return;
    provisionedRef.current = profile.uid;
    setProvisioning(true);
    ensureMyTypeTasks(plan, profile.uid)
      .then((created) => (created > 0 ? refresh() : undefined))
      .catch((reason) => setError(errorText(reason, t)))
      .finally(() => setProvisioning(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.origin, plan, profile?.uid, hasTypeTask]);

  if (snapshotQuery.isLoading)
    return <FullPageSpinner label={t("annotation.loading")} />;
  if (!profile || !snapshot)
    return <p className="text-sm">{t("annotation.loadFailed")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("annotation.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t(privileged ? "annotation.subtitle" : "annotation.subtitleAnnotator")}
        </p>
      </div>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {data?.origin === "bundled" && privileged ? (
        <Card className="border-[hsl(var(--warning))]">
          <CardHeader>
            <CardTitle>{t("annotation.enableFirestore.title")}</CardTitle>
            <CardDescription>
              {t("annotation.enableFirestore.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={busy === "seed"}
              onClick={() =>
                runAction(
                  "seed",
                  () => seedResearchProject(snapshot, profile.uid),
                  t("annotation.enableFirestore.success"),
                )
              }
            >
              {busy === "seed"
                ? t("annotation.enableFirestore.loading")
                : t("annotation.enableFirestore.button")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {privileged && plan ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("annotation.campaign.selfAssignTitle")}</CardTitle>
            <CardDescription>
              {t("annotation.campaign.prelabelExplain")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data?.origin !== "firestore" ? (
              <p className="w-full text-xs text-[hsl(var(--warning))]">
                {t("annotation.enableFirestore.description")}
              </p>
            ) : null}
            <Button
              variant="outline"
              disabled={data?.origin !== "firestore" || busy === "prelabel-type"}
              onClick={() =>
                runAction(
                  "prelabel-type",
                  () =>
                    ensureMyPreAnnotationTasks(
                      plan,
                      "type",
                      profile.uid,
                      profile.uid,
                    ).then(() => undefined),
                  t("annotation.campaign.prelabelCreated", {
                    taskType: "type",
                  }),
                )
              }
            >
              {t("annotation.campaign.startPrelabelType")}
            </Button>
            <Button
              variant="outline"
              disabled={data?.origin !== "firestore" || busy === "prelabel-token"}
              onClick={() =>
                runAction(
                  "prelabel-token",
                  () =>
                    ensureMyPreAnnotationTasks(
                      plan,
                      "token",
                      profile.uid,
                      profile.uid,
                    ).then(() => undefined),
                  t("annotation.campaign.prelabelCreated", {
                    taskType: "token",
                  }),
                )
              }
            >
              {t("annotation.campaign.startPrelabelToken")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div id="my-tasks" className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("annotation.assignments.title")}</CardTitle>
            <CardDescription>
              {t("annotation.assignments.description", {
                count: ownAssignments.length,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-auto">
            {ownAssignments.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t(
                  provisioning
                    ? "annotation.assignments.preparing"
                    : "annotation.assignments.empty",
                )}
              </p>
            ) : (
              ownAssignments.map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => setSelectedId(assignment.id)}
                  className={`w-full rounded-md border p-3 text-left text-sm hover:bg-[hsl(var(--accent))] ${selectedId === assignment.id ? "border-[hsl(var(--primary))] bg-[hsl(var(--accent))]" : "border-[hsl(var(--border))]"}`}
                >
                  <span className="block font-medium">
                    {assignment.itemSnapshot.canonicalForm}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>
                      {assignment.itemSnapshot.taskType}
                      {assignment.contextId ? ` · ${assignment.contextId}` : ""}
                    </span>
                    <Badge
                      variant={
                        assignment.status === "accepted" ||
                        assignment.status === "submitted"
                          ? "success"
                          : "warning"
                      }
                    >
                      {t(`annotation.status.${assignment.status}`)}
                    </Badge>
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {selected ? (
          <AnnotationForm
            key={selected.id}
            assignment={selected}
            annotatorId={profile.uid}
            busy={busy}
            runAction={runAction}
            onDone={() => setSelectedId(null)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("annotation.assignments.formTitle")}</CardTitle>
              <CardDescription>
                {t("annotation.assignments.formHint")}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {privileged ? (
        <ReviewPanel
          assignments={submittedForReview}
          annotations={annotationByAssignment}
          actorUid={profile.uid}
          busy={busy}
          runAction={runAction}
        />
      ) : null}

      {privileged ? (
        <AggregationPanel
          aggregates={aggregateQuery.data ?? []}
          report={reportQuery.data ?? null}
          snapshot={snapshot}
          actorUid={profile.uid}
          canAggregateNow={profile.role === "admin"}
          busy={busy}
          runAction={runAction}
        />
      ) : null}
    </div>
  );
}

function AnnotationForm({
  assignment,
  annotatorId,
  busy,
  runAction,
  onDone,
}: {
  assignment: AssignmentRecord;
  annotatorId: string;
  busy: string | null;
  runAction: (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => Promise<void>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [overallScore, setOverall] = useState(3);
  const [modifierScore, setModifier] = useState(3);
  const [headScore, setHead] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [paraphrase, setParaphrase] = useState("");
  const [comment, setComment] = useState("");
  const editable =
    assignment.status === "assigned" || assignment.status === "in_progress";

  async function submit() {
    await runAction(
      `submit-${assignment.id}`,
      async () => {
        await submitAnnotation({
          id: assignment.id,
          assignmentId: assignment.id,
          campaignId: assignment.campaignId,
          annotatorId,
          mweId: assignment.mweId,
          contextId: assignment.contextId ?? null,
          overallScore,
          modifierScore,
          headScore,
          confidence,
          paraphrase: paraphrase.trim(),
          comment: comment.trim(),
          submittedAt: new Date().toISOString(),
        });
      },
      t("annotation.form.submitSuccess"),
    );
    onDone();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          {assignment.itemSnapshot.canonicalForm}
          <Badge variant="outline">{assignment.itemSnapshot.taskType}</Badge>
        </CardTitle>
        <CardDescription>
          {assignment.itemSnapshot.modifier} + {assignment.itemSnapshot.head} ·{" "}
          {assignment.itemSnapshot.meaning}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {editable ? (
          <div className="space-y-2 rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-4 text-sm">
            <p className="font-medium">{t("annotation.form.help.title")}</p>
            <p className="text-[hsl(var(--muted-foreground))]">
              {t("annotation.form.help.task")}
            </p>
            <p className="font-medium">
              {t("annotation.form.help.scaleTitle")}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[hsl(var(--muted-foreground))]">
              <li>{t("annotation.form.help.scaleHigh")}</li>
              <li>{t("annotation.form.help.scaleMid")}</li>
              <li>{t("annotation.form.help.scaleLow")}</li>
            </ul>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("annotation.form.contextsLabel")}
          </p>
          {assignment.itemSnapshot.contexts.map((context) => (
            <div
              key={context.id}
              className="rounded-md border border-[hsl(var(--border))] p-3 text-sm"
            >
              <Badge variant="outline">{context.slot}</Badge>{" "}
              <SpanText
                sentence={context.sentence}
                surface={context.targetSurface}
                span={context.span}
              />
            </div>
          ))}
        </div>

        {editable ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreSelect
                label={t("annotation.form.overallCompositional")}
                hint={t("annotation.form.hints.overall")}
                value={overallScore}
                onChange={setOverall}
                min={0}
                max={5}
                showScoreHints
              />
              <ScoreSelect
                label={t("annotation.form.modifierContribution")}
                hint={t("annotation.form.hints.modifier", {
                  word: assignment.itemSnapshot.modifier,
                })}
                value={modifierScore}
                onChange={setModifier}
                min={0}
                max={5}
              />
              <ScoreSelect
                label={t("annotation.form.headContribution")}
                hint={t("annotation.form.hints.head", {
                  word: assignment.itemSnapshot.head,
                })}
                value={headScore}
                onChange={setHead}
                min={0}
                max={5}
              />
              <ScoreSelect
                label={t("annotation.form.confidence")}
                hint={t("annotation.form.hints.confidence")}
                value={confidence}
                onChange={setConfidence}
                min={1}
                max={5}
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">
                {t("annotation.form.paraphrase")}{" "}
                <span className="text-[hsl(var(--destructive))]">
                  {t("annotation.form.paraphraseRequired")}
                </span>
              </span>
              <span className="block text-xs font-normal text-[hsl(var(--muted-foreground))]">
                {t("annotation.form.hints.paraphrase")}
              </span>
              <span className="block text-xs font-normal italic text-[hsl(var(--muted-foreground))]">
                {t("annotation.form.hints.paraphraseExample")}
              </span>
              <textarea
                value={paraphrase}
                onChange={(event) => setParaphrase(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent p-3 outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                placeholder={t("annotation.form.paraphrasePlaceholder")}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">
                {t("annotation.form.comment")}
              </span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={2}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent p-3 outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {assignment.status === "assigned" ? (
                <Button
                  variant="outline"
                  disabled={busy === `start-${assignment.id}`}
                  onClick={() =>
                    runAction(
                      `start-${assignment.id}`,
                      () => startAssignment(assignment.id),
                      t("annotation.form.taskStarted"),
                    )
                  }
                >
                  {t("annotation.form.startTask")}
                </Button>
              ) : null}
              <Button
                disabled={
                  !paraphrase.trim() || busy === `submit-${assignment.id}`
                }
                onClick={submit}
              >
                {t("annotation.form.submitLock")}
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("annotation.form.submitNote")}
            </p>
          </>
        ) : (
          <Notice tone="success">
            {t("annotation.form.readOnly", {
              status: t(`annotation.status.${assignment.status}`),
            })}
          </Notice>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewPanel({
  assignments,
  annotations,
  actorUid,
  busy,
  runAction,
}: {
  assignments: AssignmentRecord[];
  annotations: Map<
    string,
    {
      overallScore: number;
      modifierScore: number;
      headScore: number;
      confidence: number;
      paraphrase: string;
      comment: string;
    }
  >;
  actorUid: string;
  busy: string | null;
  runAction: (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("annotation.review.title")}</CardTitle>
        <CardDescription>
          {t("annotation.review.description", { count: assignments.length })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("annotation.review.empty")}
          </p>
        ) : (
          assignments.slice(0, 50).map((assignment) => {
            const annotation = annotations.get(assignment.id);
            return (
              <div
                key={assignment.id}
                className="rounded-md border border-[hsl(var(--border))] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {assignment.itemSnapshot.canonicalForm} ·{" "}
                    {assignment.itemSnapshot.taskType}
                  </span>
                  {annotation ? (
                    <span className="tabular-nums">
                      {t("annotation.review.overallConfidence", {
                        overall: annotation.overallScore,
                        confidence: annotation.confidence,
                      })}
                    </span>
                  ) : (
                    <Badge variant="warning">
                      {t("annotation.review.responseMissing")}
                    </Badge>
                  )}
                </div>
                {annotation ? (
                  <p className="mt-2">
                    <strong>{t("annotation.review.paraphrase")}</strong>{" "}
                    {annotation.paraphrase}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    value={reasons[assignment.id] ?? ""}
                    onChange={(event) =>
                      setReasons({
                        ...reasons,
                        [assignment.id]: event.target.value,
                      })
                    }
                    placeholder={t("annotation.review.notePlaceholder")}
                    className="min-w-[260px] flex-1"
                  />
                  <Button
                    disabled={!annotation || busy === `accept-${assignment.id}`}
                    onClick={() =>
                      runAction(
                        `accept-${assignment.id}`,
                        () =>
                          reviewAssignment(
                            assignment.id,
                            "accepted",
                            actorUid,
                            reasons[assignment.id] ?? "",
                          ),
                        t("annotation.review.accepted"),
                      )
                    }
                  >
                    {t("annotation.review.accept")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={
                      !annotation ||
                      !(reasons[assignment.id] ?? "").trim() ||
                      busy === `exclude-${assignment.id}`
                    }
                    onClick={() =>
                      runAction(
                        `exclude-${assignment.id}`,
                        () =>
                          reviewAssignment(
                            assignment.id,
                            "excluded",
                            actorUid,
                            reasons[assignment.id] ?? "",
                          ),
                        t("annotation.review.excluded"),
                      )
                    }
                  >
                    {t("annotation.review.exclude")}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function AggregationPanel({
  aggregates,
  report,
  snapshot,
  actorUid,
  canAggregateNow,
  busy,
  runAction,
}: {
  aggregates: AnnotationAggregate[];
  report: {
    itemCount: number;
    requiresAdjudicationCount: number;
    ordinalKrippendorffAlpha: number | null;
    iccOneWayAverage: number | null;
  } | null;
  snapshot: NonNullable<
    ReturnType<typeof useResearchSnapshot>["data"]
  >["snapshot"];
  actorUid: string;
  canAggregateNow: boolean;
  busy: string | null;
  runAction: (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const typeAggregates = aggregates.filter(
    (item) => item.taskType === "type" && item.contextId == null,
  );
  const [selectedId, setSelectedId] = useState("");
  const selected =
    typeAggregates.find((item) => item.id === selectedId) ?? null;
  const [score, setScore] = useState("3");
  const [goldClass, setGoldClass] = useState<"I" | "PC" | "C">("PC");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!selected) return;
    setScore(selected.mean.toFixed(2));
    setGoldClass(
      selected.mean < 1.67 ? "I" : selected.mean >= 3.34 ? "C" : "PC",
    );
  }, [selected]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("annotation.aggregation.title")}</CardTitle>
        <CardDescription>
          {t("annotation.aggregation.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {canAggregateNow ? (
            <Button
              disabled={busy === "aggregate-now"}
              onClick={() =>
                runAction(
                  "aggregate-now",
                  () =>
                    aggregateAnnotationsNow(
                      snapshot.annotations,
                      snapshot.assignments,
                      actorUid,
                    ).then(() => undefined),
                  t("annotation.aggregation.aggregateNowSuccess"),
                )
              }
            >
              {t("annotation.aggregation.aggregateNow")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={busy === "aggregate-job"}
            onClick={() =>
              runAction(
                "aggregate-job",
                async () => {
                  const template = await loadJobTemplate("aggregate-tr");
                  await queueJob(
                    {
                      ...template,
                      id: `aggregate-tr-${Date.now()}`,
                      createdAt: new Date().toISOString(),
                    },
                    actorUid,
                  );
                },
                t("annotation.aggregation.queueSuccess"),
              )
            }
          >
            {t("annotation.aggregation.queueAggregate")}
          </Button>
          {report ? (
            <>
              <Badge
                variant={
                  report.ordinalKrippendorffAlpha != null &&
                  report.ordinalKrippendorffAlpha >= ALPHA_THRESHOLD
                    ? "success"
                    : "warning"
                }
              >
                α {report.ordinalKrippendorffAlpha?.toFixed(3) ?? "-"}
              </Badge>
              <span>
                {t("annotation.aggregation.itemCount", {
                  items: report.itemCount,
                  adjudication: report.requiresAdjudicationCount,
                })}
              </span>
            </>
          ) : (
            <span className="text-[hsl(var(--muted-foreground))]">
              {t("annotation.aggregation.noReport")}
            </span>
          )}
        </div>

        {typeAggregates.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">
                {t("annotation.aggregation.typeAggregate")}
              </span>
              <Select
                className="w-full"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">
                  {t("annotation.aggregation.selectMwe")}
                </option>
                {typeAggregates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t("annotation.aggregation.aggregateOption", {
                      mweId: item.mweId,
                      mean: item.mean.toFixed(2),
                      n: item.n,
                    })}
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">
                  {t("annotation.aggregation.goldScore")}
                </span>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">
                  {t("annotation.aggregation.goldClass")}
                </span>
                <Select
                  className="w-full"
                  value={goldClass}
                  onChange={(event) =>
                    setGoldClass(event.target.value as "I" | "PC" | "C")
                  }
                >
                  <option value="I">I</option>
                  <option value="PC">PC</option>
                  <option value="C">C</option>
                </Select>
              </label>
            </div>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("annotation.aggregation.expertNotePlaceholder")}
              className="md:col-span-2"
            />
            <Button
              disabled={
                !selected ||
                busy === "adjudicate" ||
                Number(score) < 0 ||
                Number(score) > 5
              }
              onClick={() => {
                const mwe = snapshot.mwes.find(
                  (item) => item.id === selected?.mweId,
                );
                if (!mwe) return;
                void runAction(
                  "adjudicate",
                  () =>
                    adjudicateMwe(
                      mwe,
                      Number(score),
                      goldClass,
                      actorUid,
                      notes,
                    ).then(() => undefined),
                  t("annotation.aggregation.goldSaved"),
                );
              }}
            >
              {t("annotation.aggregation.saveGold")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ScoreSelect({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  showScoreHints,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  showScoreHints?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {hint ? (
        <span className="block text-xs font-normal text-[hsl(var(--muted-foreground))]">
          {hint}
        </span>
      ) : null}
      <Select
        className="w-full"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {Array.from({ length: max - min + 1 }, (_, index) => index + min).map(
          (score) => (
            <option key={score} value={score}>
              {score}
              {showScoreHints
                ? score === 0
                  ? t("annotation.form.scoreHints.fullyIdiomatic")
                  : score === 5
                    ? t("annotation.form.scoreHints.fullyCompositional")
                    : ""
                : ""}
            </option>
          ),
        )}
      </Select>
    </label>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md border p-3 text-sm ${tone === "success" ? "border-green-500/40 bg-green-500/10" : "border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/10"}`}
    >
      {children}
    </div>
  );
}

function errorText(reason: unknown, t: (key: string) => string) {
  return reason instanceof Error
    ? reason.message
    : t("annotation.unexpectedError");
}
