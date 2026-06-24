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
    useExampleReviews,
    useResearchSnapshot,
    useTatoebaExampleCandidates,
} from "@/data/hooks";
import { reviewContext, reviewExampleCandidate } from "@/data/repository";
import type { ExampleCandidate, MweRecord } from "@/data/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/** Release validator requires the explicit open-license internet origin. */
function isCorpusSourced(origin: string) {
  return origin === "internet_open_license";
}

function hasCorpusExample(mwe: MweRecord) {
  return mwe.contexts.some(
    (c) => c.family === "naturalistic" && isCorpusSourced(c.provenance.origin),
  );
}

function reviewVariant(
  status: string,
): "success" | "warning" | "destructive" | "default" {
  if (status === "approved" || status.includes("checked")) return "success";
  if (status === "rejected") return "destructive";
  if (status.includes("review")) return "warning";
  return "default";
}

export function ExamplesLab() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useResearchSnapshot();
  const candidatesQuery = useTatoebaExampleCandidates();
  const reviewsQuery = useExampleReviews();
  const [search, setSearch] = useState("");
  const [onlyMissingCorpus, setOnlyMissingCorpus] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mwes = useMemo(() => data?.snapshot.mwes ?? [], [data]);
  const missingCorpusCount = useMemo(
    () => mwes.filter((m) => !hasCorpusExample(m)).length,
    [mwes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mwes.filter((m) => {
      if (onlyMissingCorpus && hasCorpusExample(m)) return false;
      if (q && !`${m.canonicalForm} ${m.id}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [mwes, search, onlyMissingCorpus]);

  const selected = useMemo(
    () => mwes.find((m) => m.id === selectedId) ?? filtered[0] ?? null,
    [mwes, selectedId, filtered],
  );

  if (isLoading) return <FullPageSpinner label={t("examples.loading")} />;
  if (isError)
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("common.dataLoadFailed", {
          message:
            error instanceof Error ? error.message : t("common.unknownError"),
        })}
      </p>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("examples.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("examples.subtitle")}{" "}
          <Badge variant={missingCorpusCount ? "warning" : "success"}>
            {t("examples.mweCount", { count: missingCorpusCount })}
          </Badge>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t("examples.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMissingCorpus}
            onChange={(e) => setOnlyMissingCorpus(e.target.checked)}
          />
          {t("examples.onlyMissingCorpus")}
        </label>
        <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))]">
          {t("examples.mweCount", { count: filtered.length })}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="max-h-[65vh] overflow-auto">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`flex w-full items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3 py-2 text-left text-sm last:border-0 hover:bg-[hsl(var(--accent))] ${
                selected?.id === m.id ? "bg-[hsl(var(--accent))]" : ""
              }`}
            >
              <span className="truncate">{m.canonicalForm}</span>
              {hasCorpusExample(m) ? (
                <Badge variant="success">{t("examples.corpusOk")}</Badge>
              ) : (
                <Badge variant="warning">{t("examples.corpusMissing")}</Badge>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("examples.noMatches")}
            </p>
          )}
        </Card>

        <div className="space-y-4">
          {selected ? (
            <ExampleDetail
              mwe={selected}
              editable={
                !!profile &&
                (profile.role === "curator" || profile.role === "admin")
              }
              firestoreReady={data?.origin === "firestore"}
              busy={busy}
              onReview={async (contextId, status, notes) => {
                if (!profile) return;
                setBusy(contextId);
                setActionError(null);
                try {
                  await reviewContext(
                    selected,
                    contextId,
                    status,
                    profile.uid,
                    notes,
                  );
                  await queryClient.invalidateQueries({
                    queryKey: ["research-snapshot"],
                  });
                } catch (reason) {
                  setActionError(
                    reason instanceof Error
                      ? reason.message
                      : t("examples.contextDecisionFailed"),
                  );
                } finally {
                  setBusy(null);
                }
              }}
            />
          ) : null}
          {selected &&
          profile &&
          (profile.role === "curator" || profile.role === "admin") ? (
            <CandidatePanel
              mwe={selected}
              candidates={(candidatesQuery.data?.candidates ?? []).filter(
                (candidate) =>
                  candidate.mweId === selected.id &&
                  candidate.datasetStatus === "candidate",
              )}
              reviewedIds={
                new Set(
                  (reviewsQuery.data ?? [])
                    .filter((review) => review.mweId === selected.id)
                    .map((review) => review.candidateId),
                )
              }
              firestoreReady={data?.origin === "firestore"}
              busy={busy}
              error={actionError}
              onReview={async (candidate, status, slot, notes) => {
                setBusy(candidate.id);
                setActionError(null);
                try {
                  await reviewExampleCandidate(
                    selected,
                    candidate,
                    status,
                    slot,
                    profile.uid,
                    notes,
                  );
                  await queryClient.invalidateQueries({
                    queryKey: ["research-snapshot"],
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ["example-reviews"],
                  });
                } catch (reason) {
                  setActionError(
                    reason instanceof Error
                      ? reason.message
                      : t("examples.exampleDecisionFailed"),
                  );
                } finally {
                  setBusy(null);
                }
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CandidatePanel({
  mwe,
  candidates,
  reviewedIds,
  firestoreReady,
  busy,
  error,
  onReview,
}: {
  mwe: MweRecord;
  candidates: ExampleCandidate[];
  reviewedIds: Set<string>;
  firestoreReady: boolean;
  busy: string | null;
  error: string | null;
  onReview: (
    candidate: ExampleCandidate,
    status: "approved" | "rejected",
    slot: "S1" | "S2" | "S3" | null,
    notes: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<Record<string, "S1" | "S2" | "S3">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = candidates.filter(
    (candidate) => !reviewedIds.has(candidate.id),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("examples.candidates.title")}</CardTitle>
        <CardDescription>
          {t("examples.candidates.description", {
            count: pending.length,
            expression: mwe.canonicalForm,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!firestoreReady ? (
          <p className="rounded border border-[hsl(var(--warning))]/40 p-2 text-xs">
            {t("examples.candidates.enableFirestore")}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
        ) : null}
        {pending.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("examples.candidates.noPending")}
          </p>
        ) : (
          pending.slice(0, 40).map((candidate) => (
            <div
              key={candidate.id}
              className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3"
            >
              <SpanText
                sentence={candidate.sentence}
                span={null}
                surface={candidate.targetSurface}
                className="text-sm"
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("examples.candidates.sentenceMeta", {
                  source: candidate.sourceName,
                  id: candidate.sourceRecordId,
                  author: candidate.author ?? t("common.authorUnknown"),
                  license: candidate.license,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={slots[candidate.id] ?? "S1"}
                  onChange={(event) =>
                    setSlots({
                      ...slots,
                      [candidate.id]: event.target.value as "S1" | "S2" | "S3",
                    })
                  }
                >
                  <option value="S1">
                    {t("examples.candidates.replaceS1")}
                  </option>
                  <option value="S2">
                    {t("examples.candidates.replaceS2")}
                  </option>
                  <option value="S3">
                    {t("examples.candidates.replaceS3")}
                  </option>
                </Select>
                <Input
                  className="min-w-[220px] flex-1"
                  value={notes[candidate.id] ?? ""}
                  onChange={(event) =>
                    setNotes({ ...notes, [candidate.id]: event.target.value })
                  }
                  placeholder={t("examples.candidates.reviewNotePlaceholder")}
                />
                <Button
                  disabled={!firestoreReady || busy === candidate.id}
                  onClick={() =>
                    void onReview(
                      candidate,
                      "approved",
                      slots[candidate.id] ?? "S1",
                      notes[candidate.id] ?? "",
                    )
                  }
                >
                  {t("common.approve")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={!firestoreReady || busy === candidate.id}
                  onClick={() =>
                    void onReview(
                      candidate,
                      "rejected",
                      null,
                      notes[candidate.id] ?? "",
                    )
                  }
                >
                  {t("common.reject")}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ExampleDetail({
  mwe,
  editable,
  firestoreReady,
  busy,
  onReview,
}: {
  mwe: MweRecord;
  editable: boolean;
  firestoreReady: boolean;
  busy: string | null;
  onReview: (
    contextId: string,
    status: "approved" | "rejected",
    notes: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const ordered = [...mwe.contexts].sort((a, b) =>
    a.slot.localeCompare(b.slot),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{mwe.canonicalForm}</CardTitle>
        <CardDescription>{mwe.meaning}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ordered.map((ctx) => (
          <div
            key={ctx.id}
            className="rounded-md border border-[hsl(var(--border))] p-3"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant={ctx.family === "neutral" ? "default" : "primary"}>
                {ctx.slot}
              </Badge>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {ctx.family}
              </span>
              {ctx.family === "naturalistic" ? (
                isCorpusSourced(ctx.provenance.origin) ? (
                  <Badge variant="success">{t("examples.corpus")}</Badge>
                ) : (
                  <Badge variant="warning">{t("examples.written")}</Badge>
                )
              ) : null}
              <Badge variant={reviewVariant(ctx.reviewStatus)}>
                {ctx.reviewStatus}
              </Badge>
            </div>
            <SpanText
              sentence={ctx.sentence}
              span={ctx.span}
              surface={ctx.targetSurface}
              className="text-sm"
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {ctx.provenance.sourceName ?? "-"}
              {ctx.provenance.license ? ` · ${ctx.provenance.license}` : ""}
              {" · "}
              {ctx.provenance.licenseReviewStatus}
            </p>
            {editable && ctx.reviewStatus !== "approved" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  className="min-w-[220px] flex-1"
                  value={notes[ctx.id] ?? ""}
                  onChange={(event) =>
                    setNotes({ ...notes, [ctx.id]: event.target.value })
                  }
                  placeholder={t("examples.contextNotePlaceholder")}
                />
                <Button
                  disabled={!firestoreReady || busy === ctx.id}
                  onClick={() =>
                    void onReview(ctx.id, "approved", notes[ctx.id] ?? "")
                  }
                >
                  {t("examples.approveContext")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={
                    !firestoreReady ||
                    busy === ctx.id ||
                    !(notes[ctx.id] ?? "").trim()
                  }
                  onClick={() =>
                    void onReview(ctx.id, "rejected", notes[ctx.id] ?? "")
                  }
                >
                  {t("common.reject")}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
