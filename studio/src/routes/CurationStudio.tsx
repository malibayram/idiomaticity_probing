import { useAuth } from "@/auth/AuthProvider";
import { SpanText } from "@/components/SpanText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { locateTokenSpan } from "@/data/context-transform";
import { useResearchSnapshot } from "@/data/hooks";
import { replaceTokenSpan } from "@/data/probe-transform";
import { reviewContext, saveMwe } from "@/data/repository";
import type { MweRecord } from "@/data/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function isCorpusSourced(origin: string) {
  return origin === "internet_open_license";
}

function naturalContexts(mwe: MweRecord) {
  return mwe.contexts
    .filter((context) => context.family === "naturalistic")
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

function hasCorpusExample(mwe: MweRecord) {
  return naturalContexts(mwe).some((context) =>
    isCorpusSourced(context.provenance.origin),
  );
}

function examplesComplete(mwe: MweRecord) {
  const slots = naturalContexts(mwe).filter((context) =>
    ["S1", "S2", "S3"].includes(context.slot),
  );
  return (
    slots.length >= 3 &&
    slots.every((context) => context.reviewStatus === "approved")
  );
}

function pCompComplete(mwe: MweRecord) {
  return (
    mwe.probes.filter(
      (probe) => probe.kind === "P_Comp" && probe.reviewStatus === "approved",
    ).length >= 2
  );
}

function reviewVariant(
  status: string,
): "success" | "warning" | "destructive" | "default" {
  if (status === "approved" || status.includes("checked")) return "success";
  if (status === "rejected") return "destructive";
  if (status.includes("review") || status === "pending") return "warning";
  return "default";
}

const CONTEXT_ORDER = ["S1", "S2", "S3", "N1", "N2"] as const;
const PROBE_KIND_ORDER = ["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand"] as const;
type ProbeKind = (typeof PROBE_KIND_ORDER)[number];

export function CurationStudio() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useResearchSnapshot();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mwes = useMemo(() => data?.snapshot.mwes ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? mwes.filter((mwe) =>
          `${mwe.canonicalForm} ${mwe.id}`.toLowerCase().includes(q),
        )
      : mwes;
  }, [mwes, search]);
  const selected = useMemo(
    () => mwes.find((mwe) => mwe.id === selectedId) ?? null,
    [mwes, selectedId],
  );
  const editable =
    !!profile && (profile.role === "curator" || profile.role === "admin");

  async function refreshSnapshot() {
    await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] });
  }

  async function saveEditedMwe(record: MweRecord) {
    if (!profile) return;
    setBusy(`save-${record.id}`);
    setActionError(null);
    try {
      await saveMwe(record, profile.uid);
      await refreshSnapshot();
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : t("common.saveFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <FullPageSpinner label={t("curation.loading")} />;
  if (isError) {
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("common.dataLoadFailed", {
          message:
            error instanceof Error ? error.message : t("common.unknownError"),
        })}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("curation.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("curation.subtitle")}
        </p>
      </div>

      <div>
        <Card className="overflow-hidden">
          <div className="border-b border-[hsl(var(--border))] p-2">
            <Input
              placeholder={t("curation.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="max-h-[72vh] overflow-auto">
            {filtered.map((mwe) => {
              const active = selected?.id === mwe.id;
              return (
                <div
                  key={mwe.id}
                  className={`border-b border-[hsl(var(--border))] last:border-0 ${
                    active ? "bg-[hsl(var(--accent))]" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(active ? null : mwe.id)
                    }
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[hsl(var(--accent))]"
                  >
                    <span className="block truncate font-medium">
                      {mwe.canonicalForm}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge
                        variant={examplesComplete(mwe) ? "success" : "warning"}
                      >
                        {t("curation.list.examples")}
                      </Badge>
                      <Badge variant={pCompComplete(mwe) ? "success" : "warning"}>
                        P_Comp{" "}
                        {
                          mwe.probes.filter(
                            (p) =>
                              p.kind === "P_Comp" &&
                              p.reviewStatus === "approved",
                          ).length
                        }
                        /2
                      </Badge>
                      {hasCorpusExample(mwe) ? (
                        <Badge variant="success">{t("examples.corpus")}</Badge>
                      ) : (
                        <Badge variant="warning">{t("examples.written")}</Badge>
                      )}
                    </span>
                  </button>
                  {active ? (
                    <div className="px-3 pb-3">
                      <ExpressionEditors
                        mwe={mwe}
                        editable={editable}
                        firestoreReady={data?.origin === "firestore"}
                        busy={busy}
                        onSave={saveEditedMwe}
                        onContextReview={async (contextId, status, notes) => {
                          if (!profile) return;
                          setBusy(contextId);
                          setActionError(null);
                          try {
                            await reviewContext(
                              mwe,
                              contextId,
                              status,
                              profile.uid,
                              notes,
                            );
                            await refreshSnapshot();
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
                      {actionError ? (
                        <p className="mt-2 text-xs text-[hsl(var(--destructive))]">
                          {actionError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function regenerateVariants(record: MweRecord): MweRecord {
  const previous = new Map(record.variants.map((variant) => [variant.id, variant]));
  const variants = record.contexts.flatMap((context) => {
    if (!context.span) return [];
    const span = context.span;
    return record.probes.map((probe) => {
      const replaced = replaceTokenSpan(
        context.sentence,
        span,
        probe.lexicalForm,
      );
      const id = `${context.id}-${probe.id}`;
      return {
        id,
        contextId: context.id,
        probeKind: probe.kind,
        candidateId: probe.id,
        sentence: replaced.sentence,
        targetSurface: replaced.targetSurface,
        span: replaced.span,
        grammarReviewStatus:
          previous.get(id)?.grammarReviewStatus ?? ("review_required" as const),
      };
    });
  });
  return { ...record, variants };
}

function ExpressionEditors({
  mwe,
  editable,
  firestoreReady,
  busy,
  onSave,
  onContextReview,
}: {
  mwe: MweRecord;
  editable: boolean;
  firestoreReady: boolean;
  busy: string | null;
  onSave: (record: MweRecord) => Promise<void>;
  onContextReview: (
    contextId: string,
    status: "approved" | "rejected",
    notes: string,
  ) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <ClassDropdown
        mwe={mwe}
        editable={editable}
        firestoreReady={firestoreReady}
        busy={busy}
        onSave={onSave}
      />
      <ExamplesDropdown
        mwe={mwe}
        editable={editable}
        firestoreReady={firestoreReady}
        busy={busy}
        onSave={onSave}
        onContextReview={onContextReview}
      />
    </div>
  );
}

function ClassDropdown({
  mwe,
  editable,
  firestoreReady,
  busy,
  onSave,
}: {
  mwe: MweRecord;
  editable: boolean;
  firestoreReady: boolean;
  busy: string | null;
  onSave: (record: MweRecord) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [provisionalClass, setProvisionalClass] =
    useState<MweRecord["provisionalClass"]>(mwe.provisionalClass);
  return (
    <details className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        {t("curation.edit.classTitle")} · {mwe.provisionalClass}
      </summary>
      <div className="space-y-2 border-t border-[hsl(var(--border))] p-3">
        <Select
          className="max-w-xs"
          value={provisionalClass}
          disabled={!editable || !firestoreReady}
          onChange={(event) =>
            setProvisionalClass(
              event.target.value as MweRecord["provisionalClass"],
            )
          }
        >
          <option value="I">I · Idiomatic</option>
          <option value="PC">PC · Partially compositional</option>
          <option value="C">C · Compositional</option>
        </Select>
        <Button
          size="sm"
          disabled={
            !editable ||
            !firestoreReady ||
            busy === `save-${mwe.id}` ||
            provisionalClass === mwe.provisionalClass
          }
          onClick={() => void onSave({ ...mwe, provisionalClass })}
        >
          {t("common.save")}
        </Button>
      </div>
    </details>
  );
}

function ExamplesDropdown({
  mwe,
  editable,
  firestoreReady,
  busy,
  onSave,
  onContextReview,
}: {
  mwe: MweRecord;
  editable: boolean;
  firestoreReady: boolean;
  busy: string | null;
  onSave: (record: MweRecord) => Promise<void>;
  onContextReview: (
    contextId: string,
    status: "approved" | "rejected",
    notes: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openInfo, setOpenInfo] = useState<Record<string, boolean>>({});
  const editableContexts = [...mwe.contexts].sort(
    (a, b) =>
      CONTEXT_ORDER.indexOf(a.slot as (typeof CONTEXT_ORDER)[number]) -
      CONTEXT_ORDER.indexOf(b.slot as (typeof CONTEXT_ORDER)[number]),
  );
  const [sentences, setSentences] = useState<Record<string, string>>(
    Object.fromEntries(editableContexts.map((context) => [context.id, context.sentence])),
  );
  const [variantSentences, setVariantSentences] = useState<Record<string, string>>(
    Object.fromEntries(mwe.variants.map((variant) => [variant.id, variant.sentence])),
  );
  const [manualProbeForms, setManualProbeForms] = useState<Record<string, string>>({});
  const previewVariants = useMemo(() => regenerateVariants(mwe).variants, [mwe]);
  function addManualProbe(kind: ProbeKind, lexicalForm: string) {
    const trimmed = lexicalForm.trim();
    if (!trimmed) return;
    const rank =
      Math.max(0, ...mwe.probes.filter((probe) => probe.kind === kind).map((probe) => probe.rank)) +
      1;
    const id = `${mwe.id}-${kind}-manual-${Date.now()}`;
    const next = regenerateVariants({
      ...mwe,
      probes: [
        ...mwe.probes,
        {
          id,
          kind,
          lexicalForm: trimmed,
          source: "manual_curation",
          reviewStatus: "approved",
          rank,
          notes: "Manual curation studio entry",
          senseReviewStatus: "approved_by_curator",
          grammarReviewStatus: "review_required",
        },
      ],
    });
    void onSave(next);
  }
  function saveExamples() {
    const contexts = mwe.contexts.map((context) => {
      if (!sentences[context.id]) return context;
      const sentence = sentences[context.id].trim();
      const span = locateTokenSpan(sentence, context.targetSurface);
      if (!span) {
        throw new Error(
          `${context.slot}: "${context.targetSurface}" cümlede bulunamadı.`,
        );
      }
      return {
        ...context,
        sentence,
        span,
        reviewStatus:
          sentence === context.sentence ? context.reviewStatus : "review_required",
      };
    });
    const regenerated = regenerateVariants({ ...mwe, contexts });
    const variants = regenerated.variants.map((variant) => {
      const draft = variantSentences[variant.id]?.trim();
      if (!draft || draft === variant.sentence) return variant;
      const span = locateTokenSpan(draft, variant.targetSurface);
      if (!span) {
        throw new Error(
          `${variant.id}: "${variant.targetSurface}" cümlede bulunamadı.`,
        );
      }
      return {
        ...variant,
        sentence: draft,
        span,
        grammarReviewStatus: "review_required" as const,
      };
    });
    void onSave({ ...regenerated, variants });
  }
  return (
    <details className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]" open>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        {t("curation.edit.examplesTitle")}
      </summary>
      <div className="space-y-2 border-t border-[hsl(var(--border))] p-3">
        {editableContexts.map((context) => (
          <div
            key={context.id}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2"
          >
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  context.family === "neutral" ? "default" : "primary"
                }
              >
                {context.slot}
              </Badge>
              <Badge variant={reviewVariant(context.reviewStatus)}>
                {context.reviewStatus}
              </Badge>
              {context.family === "naturalistic" ? (
                <Badge
                  variant={
                    isCorpusSourced(context.provenance.origin)
                      ? "success"
                      : "warning"
                  }
                >
                  {isCorpusSourced(context.provenance.origin)
                    ? t("examples.corpus")
                    : t("examples.written")}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-start gap-2">
              <SpanText
                sentence={context.sentence}
                span={context.span}
                surface={context.targetSurface}
                className="min-w-0 flex-1 text-sm leading-6"
              />
              <div className="ml-auto shrink-0">
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                  aria-label={t("curation.contexts.sourceInfo")}
                  title={t("curation.contexts.sourceInfo")}
                  onClick={() =>
                    setOpenInfo({
                      ...openInfo,
                      [context.id]: !openInfo[context.id],
                    })
                  }
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {openInfo[context.id] ? (
              <div className="mt-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-2 text-xs text-[hsl(var(--muted-foreground))]">
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {t("curation.contexts.source")}
                  </span>{" "}
                  {context.provenance.sourceName ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {t("curation.contexts.license")}
                  </span>{" "}
                  {context.provenance.license || "-"}
                </p>
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {t("curation.contexts.licenseStatus")}
                  </span>{" "}
                  {context.provenance.licenseReviewStatus}
                </p>
                <p>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {t("curation.contexts.origin")}
                  </span>{" "}
                  {context.provenance.origin}
                </p>
              </div>
            ) : null}
            <textarea
              className="mt-2 min-h-16 w-full rounded-md border border-[hsl(var(--input))] bg-transparent p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              value={sentences[context.id] ?? context.sentence}
              disabled={!editable || !firestoreReady}
              onChange={(event) =>
                setSentences({
                  ...sentences,
                  [context.id]: event.target.value,
                })
              }
            />
            {editable && context.reviewStatus !== "approved" ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
                <Input
                  className="h-8 min-w-0 text-sm"
                  value={notes[context.id] ?? ""}
                  onChange={(event) =>
                    setNotes({ ...notes, [context.id]: event.target.value })
                  }
                  placeholder={t("examples.contextNotePlaceholder")}
                />
                <Button
                  size="sm"
                  disabled={!firestoreReady || busy === context.id}
                  onClick={() =>
                    void onContextReview(
                      context.id,
                      "approved",
                      notes[context.id] ?? "",
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
                    busy === context.id ||
                    !(notes[context.id] ?? "").trim()
                  }
                  onClick={() =>
                    void onContextReview(
                      context.id,
                      "rejected",
                      notes[context.id] ?? "",
                    )
                  }
                >
                  {t("common.reject")}
                </Button>
              </div>
            ) : null}
            <ContextProbeVariants
              contextId={context.id}
              variants={previewVariants.filter(
                (variant) => variant.contextId === context.id,
              )}
              values={variantSentences}
              manualValues={manualProbeForms}
              disabled={!editable || !firestoreReady}
              saving={busy === `save-${mwe.id}`}
              onChange={(variantId, sentence) =>
                setVariantSentences({
                  ...variantSentences,
                  [variantId]: sentence,
                })
              }
              onManualChange={(key, lexicalForm) =>
                setManualProbeForms({
                  ...manualProbeForms,
                  [key]: lexicalForm,
                })
              }
              onAddProbe={addManualProbe}
              onSaveEdits={saveExamples}
            />
          </div>
        ))}
        <Button
          size="sm"
          disabled={!editable || !firestoreReady || busy === `save-${mwe.id}`}
          onClick={saveExamples}
        >
          {t("common.save")}
        </Button>
      </div>
    </details>
  );
}

function ContextProbeVariants({
  contextId,
  variants,
  values,
  manualValues,
  disabled,
  saving,
  onChange,
  onManualChange,
  onAddProbe,
  onSaveEdits,
}: {
  contextId: string;
  variants: MweRecord["variants"];
  values: Record<string, string>;
  manualValues: Record<string, string>;
  disabled: boolean;
  saving: boolean;
  onChange: (variantId: string, sentence: string) => void;
  onManualChange: (key: string, lexicalForm: string) => void;
  onAddProbe: (kind: ProbeKind, lexicalForm: string) => void;
  onSaveEdits: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 space-y-2">
      {PROBE_KIND_ORDER.map((kind) => {
        const items = variants.filter((variant) => variant.probeKind === kind);
        const manualKey = `${contextId}-${kind}`;
        return (
          <details
            key={`${contextId}-${kind}`}
            open={items.length > 0 || undefined}
            className="rounded-md bg-[hsl(var(--muted))]/40"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {kind} · {t(`reference.probes.${kind}`)} ({items.length})
            </summary>
            <div className="space-y-2 border-t border-[hsl(var(--border))] p-2">
              {items.length === 0 ? (
                <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-start">
                  <Input
                    className="h-9 min-w-0 text-sm"
                    value={manualValues[manualKey] ?? ""}
                    disabled={disabled || saving}
                    placeholder={t("curation.edit.probeFormPlaceholder", {
                      kind,
                    })}
                    onChange={(event) =>
                      onManualChange(manualKey, event.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      disabled ||
                      saving ||
                      !(manualValues[manualKey] ?? "").trim()
                    }
                    onClick={() =>
                      onAddProbe(kind, manualValues[manualKey] ?? "")
                    }
                  >
                    {t("curation.edit.saveEdit")}
                  </Button>
                </div>
              ) : (
                items.map((variant) => (
                  <div key={variant.id} className="space-y-1">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={reviewVariant(variant.grammarReviewStatus)}>
                        {variant.grammarReviewStatus}
                      </Badge>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {variant.targetSurface}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-start">
                      <textarea
                        className="min-h-12 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                        value={values[variant.id] ?? variant.sentence}
                        disabled={disabled}
                        onChange={(event) =>
                          onChange(variant.id, event.target.value)
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          disabled ||
                          saving ||
                          (values[variant.id] ?? variant.sentence).trim() ===
                            variant.sentence
                        }
                        onClick={onSaveEdits}
                      >
                        {t("curation.edit.saveEdit")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
