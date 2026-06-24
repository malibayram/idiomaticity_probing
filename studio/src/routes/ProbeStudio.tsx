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
import { FullPageSpinner } from "@/components/ui/spinner";
import {
    useKenetProbeCandidates,
    useOrdinaryControlArtifact,
    useOrdinaryControlReviews,
    useProbeReviews,
    useRandomProbeCandidates,
    useResearchSnapshot,
} from "@/data/hooks";
import {
    reviewExistingProbe,
    reviewOrdinaryControlItem,
    reviewProbeCandidate,
    reviewVariantGrammar,
} from "@/data/repository";
import type {
    MweRecord,
    OrdinaryControlItem,
    ProbeCandidateRecord,
} from "@/data/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

// Target probe multiplicities per MWE (docs plan: Prob stüdyosu).
const PROBE_TARGETS: Record<string, number> = {
  P_Syn: 1,
  P_Comp: 2,
  P_WordsSyn: 5,
  P_Rand: 5,
};
const PROBE_ORDER = ["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand"] as const;

function reviewVariant(
  status: string,
): "success" | "warning" | "destructive" | "default" {
  if (status === "approved") return "success";
  if (status === "rejected") return "destructive";
  if (status === "review_required" || status === "pending") return "warning";
  return "default";
}

export function ProbeStudio() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useResearchSnapshot();
  const kenetQuery = useKenetProbeCandidates();
  const randomQuery = useRandomProbeCandidates();
  const reviewsQuery = useProbeReviews();
  const controlQuery = useOrdinaryControlArtifact();
  const controlReviewsQuery = useOrdinaryControlReviews();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mwes = useMemo(() => data?.snapshot.mwes ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? mwes.filter((m) =>
          `${m.canonicalForm} ${m.id}`.toLowerCase().includes(q),
        )
      : mwes;
  }, [mwes, search]);

  const selected = useMemo(
    () => mwes.find((m) => m.id === selectedId) ?? filtered[0] ?? null,
    [mwes, selectedId, filtered],
  );

  if (isLoading) return <FullPageSpinner label={t("probes.loading")} />;
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
        <h1 className="text-2xl font-semibold">{t("probes.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("probes.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[hsl(var(--border))] p-2">
            <Input
              placeholder={t("probes.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[65vh] overflow-auto">
            {filtered.map((m) => (
              <ProbeListItem
                key={m.id}
                mwe={m}
                active={selected?.id === m.id}
                onClick={() => setSelectedId(m.id)}
              />
            ))}
          </div>
        </Card>

        <div>
          {selected ? (
            <div className="space-y-4">
              <ProbeDetail
                mwe={selected}
                editable={
                  !!profile &&
                  (profile.role === "curator" || profile.role === "admin")
                }
                firestoreReady={data?.origin === "firestore"}
                busy={busy}
                onProbeReview={async (probeId, status, notes) => {
                  if (!profile) return;
                  setBusy(probeId);
                  setActionError(null);
                  try {
                    await reviewExistingProbe(
                      selected,
                      probeId,
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
                        : t("probes.probeDecisionFailed"),
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
                onVariantReview={async (variantId, status, notes) => {
                  if (!profile) return;
                  setBusy(variantId);
                  setActionError(null);
                  try {
                    await reviewVariantGrammar(
                      selected,
                      variantId,
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
                        : t("probes.variantDecisionFailed"),
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
              />
              {profile &&
              (profile.role === "curator" || profile.role === "admin") ? (
                <CandidateReviewPanels
                  mwe={selected}
                  kenet={
                    kenetQuery.data?.items.find(
                      (item) => item.mweId === selected.id,
                    )?.candidates ?? []
                  }
                  random={
                    randomQuery.data?.items.find(
                      (item) => item.mweId === selected.id,
                    )?.candidates ?? []
                  }
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
                  onReview={async (candidate, status, notes) => {
                    setBusy(candidate.id);
                    setActionError(null);
                    try {
                      await reviewProbeCandidate(
                        selected,
                        candidate,
                        status,
                        profile.uid,
                        notes,
                      );
                      await queryClient.invalidateQueries({
                        queryKey: ["research-snapshot"],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["probe-reviews"],
                      });
                    } catch (reason) {
                      setActionError(
                        reason instanceof Error
                          ? reason.message
                          : t("probes.probeDecisionFailed"),
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
              ) : null}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("probes.noSelection")}</CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
      {profile &&
      (profile.role === "curator" || profile.role === "admin") &&
      controlQuery.data ? (
        <OrdinaryControlPanel
          items={controlQuery.data.items}
          reviewedIds={
            new Set(
              (controlReviewsQuery.data ?? []).map((review) => review.itemId),
            )
          }
          firestoreReady={data?.origin === "firestore"}
          reviewerUid={profile.uid}
          onChanged={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["ordinary-control-reviews"],
            });
            await queryClient.invalidateQueries({
              queryKey: ["research-snapshot"],
            });
          }}
        />
      ) : null}
    </div>
  );
}

function OrdinaryControlPanel({
  items,
  reviewedIds,
  firestoreReady,
  reviewerUid,
  onChanged,
}: {
  items: OrdinaryControlItem[];
  reviewedIds: Set<string>;
  firestoreReady: boolean;
  reviewerUid: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [group, setGroup] = useState("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const pending = items.filter(
    (item) =>
      !reviewedIds.has(item.item_id) &&
      (group === "all" || item.group === group),
  );
  async function decide(
    item: OrdinaryControlItem,
    status: "approved" | "rejected",
  ) {
    setBusy(item.item_id);
    try {
      await reviewOrdinaryControlItem(
        item,
        status,
        reviewerUid,
        notes[item.item_id] ?? "",
      );
      await onChanged();
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("probes.ordinaryControl.title")}</CardTitle>
        <CardDescription>
          {t("probes.ordinaryControl.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="all">{t("probes.ordinaryControl.allGroups")}</option>
            <option value="idiomatic_nc">
              {t("probes.ordinaryControl.groups.idiomatic_nc")}
            </option>
            <option value="compositional_nc">
              {t("probes.ordinaryControl.groups.compositional_nc")}
            </option>
            <option value="single_word_control">
              {t("probes.ordinaryControl.groups.single_word_control")}
            </option>
            <option value="ordinary_two_word_control">
              {t("probes.ordinaryControl.groups.ordinary_two_word_control")}
            </option>
          </select>
          <Badge variant={pending.length ? "warning" : "success"}>
            {t("probes.ordinaryControl.decisionsPending", {
              count: pending.length,
            })}
          </Badge>
        </div>
        {pending.slice(0, 64).map((item) => (
          <div
            key={item.item_id}
            className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3"
          >
            <div className="flex flex-wrap gap-2">
              <strong>{item.name}</strong>
              <Badge variant="outline">
                {t(`probes.ordinaryControl.groups.${item.group}`)}
              </Badge>
              <Badge variant="warning">
                {t("probes.ordinaryControl.frequency", {
                  status: item.frequency_match_status,
                })}
              </Badge>
            </div>
            <p className="text-sm">{item.original}</p>
            <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-5">
              <span>
                <b>{t("probes.ordinaryControl.fields.syn")}</b> {item.synonym}
              </span>
              <span>
                <b>{t("probes.ordinaryControl.fields.comp")}</b>{" "}
                {item.component || "-"}
              </span>
              <span>
                <b>{t("probes.ordinaryControl.fields.words")}</b>{" "}
                {item.word_by_word || "-"}
              </span>
              <span>
                <b>{t("probes.ordinaryControl.fields.related")}</b>{" "}
                {item.related || "-"}
              </span>
              <span>
                <b>{t("probes.ordinaryControl.fields.random")}</b> {item.random}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[220px] flex-1"
                value={notes[item.item_id] ?? ""}
                onChange={(event) =>
                  setNotes({ ...notes, [item.item_id]: event.target.value })
                }
                placeholder={t("probes.ordinaryControl.reviewNotePlaceholder")}
              />
              <Button
                disabled={!firestoreReady || busy === item.item_id}
                onClick={() => void decide(item, "approved")}
              >
                {t("common.approve")}
              </Button>
              <Button
                variant="destructive"
                disabled={!firestoreReady || busy === item.item_id}
                onClick={() => void decide(item, "rejected")}
              >
                {t("common.reject")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CandidateReviewPanels({
  mwe,
  kenet,
  random,
  reviewedIds,
  firestoreReady,
  busy,
  error,
  onReview,
}: {
  mwe: MweRecord;
  kenet: ProbeCandidateRecord[];
  random: ProbeCandidateRecord[];
  reviewedIds: Set<string>;
  firestoreReady: boolean;
  busy: string | null;
  error: string | null;
  onReview: (
    candidate: ProbeCandidateRecord,
    status: "approved" | "rejected",
    notes: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const renderPool = (
    title: string,
    description: string,
    candidates: ProbeCandidateRecord[],
  ) => {
    const pending = candidates.filter(
      (candidate) => !reviewedIds.has(candidate.id),
    );
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description} ·{" "}
            {t("probes.pools.pendingDecisions", { count: pending.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("probes.pools.noPending")}
            </p>
          ) : (
            pending.slice(0, 40).map((candidate) => (
              <div
                key={candidate.id}
                className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{candidate.lexicalForm}</strong>
                  <Badge variant="outline">{candidate.kind}</Badge>
                  <Badge variant="warning">{candidate.reviewStatus}</Badge>
                  {candidate.frequency != null ? (
                    <span className="text-xs">
                      f={candidate.frequency.toFixed(2)}/M · Δlog{" "}
                      {candidate.logFrequencyDelta?.toFixed(3)}
                    </span>
                  ) : null}
                </div>
                {candidate.definitions?.length ? (
                  <p className="text-xs">
                    <strong>{t("probes.pools.definition")}</strong>{" "}
                    {candidate.definitions.slice(0, 2).join(" · ")}
                  </p>
                ) : null}
                {candidate.examples?.length ? (
                  <p className="text-xs">
                    <strong>{t("probes.pools.kenetExample")}</strong>{" "}
                    {candidate.examples[0]}
                  </p>
                ) : null}
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {candidate.source} ·{" "}
                  {candidate.license ?? t("common.licenseReviewRequired")} ·{" "}
                  {candidate.notes ?? ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-[220px] flex-1"
                    value={notes[candidate.id] ?? ""}
                    onChange={(event) =>
                      setNotes({ ...notes, [candidate.id]: event.target.value })
                    }
                    placeholder={t("probes.pools.reviewNotePlaceholder")}
                  />
                  <Button
                    disabled={!firestoreReady || busy === candidate.id}
                    onClick={() =>
                      void onReview(
                        candidate,
                        "approved",
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
  };
  return (
    <div className="space-y-4">
      {!firestoreReady ? (
        <p className="rounded border border-[hsl(var(--warning))]/40 p-2 text-xs">
          {t("probes.enableFirestore")}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
      ) : null}
      {renderPool(
        t("probes.pools.kenetTitle"),
        t("probes.pools.kenetDescription", { expression: mwe.canonicalForm }),
        kenet,
      )}
      {renderPool(
        t("probes.pools.randomTitle"),
        t("probes.pools.randomDescription"),
        random,
      )}
    </div>
  );
}

function ProbeListItem({
  mwe,
  active,
  onClick,
}: {
  mwe: MweRecord;
  active: boolean;
  onClick: () => void;
}) {
  const total = mwe.probes.length;
  const target = Object.values(PROBE_TARGETS).reduce((a, b) => a + b, 0);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3 py-2 text-left text-sm last:border-0 hover:bg-[hsl(var(--accent))] ${
        active ? "bg-[hsl(var(--accent))]" : ""
      }`}
    >
      <span className="truncate">{mwe.canonicalForm}</span>
      <Badge variant={total >= target ? "success" : "warning"}>
        {total}/{target}
      </Badge>
    </button>
  );
}

function ProbeDetail({
  mwe,
  editable,
  firestoreReady,
  busy,
  onProbeReview,
  onVariantReview,
}: {
  mwe: MweRecord;
  editable: boolean;
  firestoreReady: boolean;
  busy: string | null;
  onProbeReview: (
    probeId: string,
    status: "approved" | "rejected",
    notes: string,
  ) => Promise<void>;
  onVariantReview: (
    variantId: string,
    status: "approved" | "rejected",
    notes: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{mwe.canonicalForm}</CardTitle>
        <CardDescription>
          {mwe.id} · {mwe.modifier} + {mwe.head}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PROBE_ORDER.map((kind) => {
          const items = mwe.probes
            .filter((p) => p.kind === kind)
            .sort((a, b) => a.rank - b.rank);
          const target = PROBE_TARGETS[kind];
          return (
            <div key={kind}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium">{kind}</span>
                <Badge variant={items.length >= target ? "success" : "warning"}>
                  {items.length}/{target}
                </Badge>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t("probes.noCandidates")}
                </p>
              ) : (
                <div className="space-y-1">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border border-[hsl(var(--border))] px-2 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {p.lexicalForm}
                          <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                            {p.source}
                          </span>
                        </span>
                        <Badge variant={reviewVariant(p.reviewStatus)}>
                          {p.reviewStatus}
                        </Badge>
                      </div>
                      {editable && p.reviewStatus !== "approved" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Input
                            className="min-w-[200px] flex-1"
                            value={notes[p.id] ?? ""}
                            onChange={(event) =>
                              setNotes({ ...notes, [p.id]: event.target.value })
                            }
                            placeholder={t("probes.probeNotePlaceholder")}
                          />
                          <Button
                            size="sm"
                            disabled={!firestoreReady || busy === p.id}
                            onClick={() =>
                              void onProbeReview(
                                p.id,
                                "approved",
                                notes[p.id] ?? "",
                              )
                            }
                          >
                            {t("common.approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={
                              !firestoreReady ||
                              busy === p.id ||
                              !(notes[p.id] ?? "").trim()
                            }
                            onClick={() =>
                              void onProbeReview(
                                p.id,
                                "rejected",
                                notes[p.id] ?? "",
                              )
                            }
                          >
                            {t("common.reject")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("probes.generatedVariants")}
            </span>
            <Badge
              variant={
                mwe.variants.every(
                  (variant) => variant.grammarReviewStatus === "approved",
                )
                  ? "success"
                  : "warning"
              }
            >
              {
                mwe.variants.filter(
                  (variant) => variant.grammarReviewStatus === "approved",
                ).length
              }
              /{mwe.variants.length}
            </Badge>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-auto">
            {mwe.variants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-md border border-[hsl(var(--border))] p-2"
              >
                <div className="mb-1 flex flex-wrap gap-2">
                  <Badge variant="outline">{variant.probeKind}</Badge>
                  <Badge variant={reviewVariant(variant.grammarReviewStatus)}>
                    {variant.grammarReviewStatus}
                  </Badge>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {variant.contextId}
                  </span>
                </div>
                <SpanText
                  sentence={variant.sentence}
                  surface={variant.targetSurface}
                  span={variant.span}
                  className="text-xs"
                />
                {editable && variant.grammarReviewStatus !== "approved" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input
                      className="min-w-[200px] flex-1"
                      value={notes[variant.id] ?? ""}
                      onChange={(event) =>
                        setNotes({ ...notes, [variant.id]: event.target.value })
                      }
                      placeholder={t("probes.grammarNotePlaceholder")}
                    />
                    <Button
                      size="sm"
                      disabled={!firestoreReady || busy === variant.id}
                      onClick={() =>
                        void onVariantReview(
                          variant.id,
                          "approved",
                          notes[variant.id] ?? "",
                        )
                      }
                    >
                      {t("probes.approveGrammar")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        !firestoreReady ||
                        busy === variant.id ||
                        !(notes[variant.id] ?? "").trim()
                      }
                      onClick={() =>
                        void onVariantReview(
                          variant.id,
                          "rejected",
                          notes[variant.id] ?? "",
                        )
                      }
                    >
                      {t("common.reject")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
