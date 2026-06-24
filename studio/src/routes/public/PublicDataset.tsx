import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicHeader } from "@/components/public/PublicHeader";
import { SpanText } from "@/components/SpanText";
import type {
    MweRecord,
    OrdinaryControlItem,
    ReferenceMweRecord,
} from "@/data/schema";
import {
    loadPublicDataset,
    type PublicItem,
    type PublicLanguage,
} from "@/lib/public-publication";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Database,
    Filter,
    LockKeyhole,
    Search,
    ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const languageKeys: PublicLanguage[] = ["EN", "PT", "TR", "CTRL"];

function isControl(item: PublicItem): item is OrdinaryControlItem {
  return "item_id" in item;
}

function isTurkishMwe(item: PublicItem): item is MweRecord {
  return "meaning" in item && "provisionalClass" in item;
}

function isReferenceMwe(item: PublicItem): item is ReferenceMweRecord {
  return !isControl(item) && !isTurkishMwe(item);
}

function itemName(item: PublicItem): string {
  return isControl(item) ? item.name : item.canonicalForm;
}

function itemClass(item: PublicItem): string {
  if (isControl(item)) return item.group;
  if (isTurkishMwe(item)) return item.goldClass ?? item.provisionalClass;
  return item.goldClass ?? "unscored";
}

function searchableText(item: PublicItem): string {
  if (isControl(item))
    return [
      item.name,
      item.original,
      item.synonym,
      item.component,
      item.word_by_word,
      item.random,
    ]
      .join(" ")
      .toLocaleLowerCase("tr");
  if (isTurkishMwe(item))
    return [
      item.canonicalForm,
      item.meaning,
      ...item.contexts.map((c) => c.sentence),
      ...item.variants.map((v) => v.sentence),
    ]
      .join(" ")
      .toLocaleLowerCase("tr");
  return [
    item.canonicalForm,
    ...item.contexts.flatMap((c) => [
      c.original.sentence,
      ...Object.values(c.probes)
        .flat()
        .map((v) => v.sentence),
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("tr");
}

function ClassPill({ value }: { value: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    I: "bg-[#f7e4df] text-[#924a39]",
    PC: "bg-[#fff0c9] text-[#745c20]",
    C: "bg-[#dfeee7] text-[#2e6657]",
    idiomatic_nc: "bg-[#f7e4df] text-[#924a39]",
    compositional_nc: "bg-[#dfeee7] text-[#2e6657]",
    single_word_control: "bg-[#e2e9f2] text-[#405c7b]",
    ordinary_two_word_control: "bg-[#ebe3f2] text-[#664b7b]",
    unscored: "bg-[#e8e7e1] text-[#666b67]",
  };
  const labelKey = `public.dataset.classPill.${value}` as const;
  const label = t(labelKey, { defaultValue: value });
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${map[value] ?? map.unscored}`}
    >
      {label}
    </span>
  );
}

function ReferenceCard({ item }: { item: ReferenceMweRecord }) {
  const { t } = useTranslation();
  return (
    <details className="group rounded-2xl border border-[#d5d1c5] bg-white/70 open:bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 marker:hidden">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl text-[#183331]">
            {item.canonicalForm}
          </h2>
          <p className="mt-1 text-xs text-[#707a75]">
            {t("public.dataset.referenceCard.meta", {
              modifier: item.modifier,
              head: item.head,
            })}
          </p>
        </div>
        <ClassPill value={item.goldClass ?? "unscored"} />
        <span className="font-mono text-xs font-bold text-[#8c5a43]">
          {item.goldScore?.toFixed(2) ?? "-"}/5
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d1cdc1] text-lg transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-5 border-t border-[#e2ded3] p-5">
        {item.contexts.map((context) => (
          <section key={context.id} className="rounded-xl bg-[#f5f3ec] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8e5c45]">
                {context.slot} · {context.family}
              </span>
              <span className="text-[10px] text-[#7b847f]">
                {context.sourceFile}
              </span>
            </div>
            <p className="text-sm leading-7">
              <SpanText
                sentence={context.original.sentence}
                span={context.original.span}
                surface={context.original.targetSurface}
              />
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {Object.entries(context.probes).map(([kind, variants]) => (
                <div
                  key={kind}
                  className="rounded-lg border border-[#dedad0] bg-white/75 p-3"
                >
                  <p className="mb-2 font-mono text-[10px] font-bold text-[#476d64]">
                    {kind} · {t(`public.dataset.probes.${kind}`)}
                  </p>
                  <div className="space-y-2">
                    {variants.map((variant, index) => (
                      <p
                        key={`${kind}-${index}`}
                        className="text-xs leading-5 text-[#4f5e58]"
                      >
                        <SpanText
                          sentence={variant.sentence}
                          span={variant.span}
                          surface={variant.targetSurface}
                        />
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}

function TurkishCard({ item }: { item: MweRecord }) {
  const { t } = useTranslation();
  return (
    <details className="group rounded-2xl border border-[#d5d1c5] bg-white/70 open:bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 marker:hidden">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl text-[#183331]">
            {item.canonicalForm}
          </h2>
          <p className="mt-1 text-sm text-[#5d6964]">{item.meaning}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8a918d]">
            {t("public.dataset.turkishCard.provisionalNote")}
          </p>
        </div>
        <ClassPill value={item.goldClass ?? item.provisionalClass} />
        <span className="font-mono text-xs font-bold text-[#8c5a43]">
          {item.goldScore?.toFixed(2) ??
            t("public.dataset.turkishCard.goldPending")}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d1cdc1] text-lg transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-5 border-t border-[#e2ded3] p-5">
        {item.contexts.map((context) => {
          const variants = item.variants.filter(
            (variant) => variant.contextId === context.id,
          );
          const grouped = variants.reduce<Record<string, typeof variants>>(
            (acc, variant) => {
              (acc[variant.probeKind] ??= []).push(variant);
              return acc;
            },
            {},
          );
          return (
            <section key={context.id} className="rounded-xl bg-[#f5f3ec] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8e5c45]">
                  {context.slot} · {context.family}
                </span>
                <span className="text-[10px] text-[#78827d]">
                  {context.provenance.origin} · {context.reviewStatus}
                </span>
              </div>
              <p className="text-sm leading-7">
                <SpanText
                  sentence={context.sentence}
                  span={context.span}
                  surface={context.targetSurface}
                />
              </p>
              {variants.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {Object.entries(grouped).map(([kind, rows]) => (
                    <div
                      key={kind}
                      className="rounded-lg border border-[#dedad0] bg-white/75 p-3"
                    >
                      <p className="mb-2 font-mono text-[10px] font-bold text-[#476d64]">
                        {kind} · {t(`public.dataset.probes.${kind}`)}
                      </p>
                      <div className="space-y-2">
                        {rows.map((variant) => (
                          <p
                            key={variant.id}
                            className="text-xs leading-5 text-[#4f5e58]"
                          >
                            <SpanText
                              sentence={variant.sentence}
                              span={variant.span}
                              surface={variant.targetSurface}
                            />
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs italic text-[#7b847f]">
                  {t("public.dataset.turkishCard.noApprovedVariants")}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </details>
  );
}

function ControlCard({ item }: { item: OrdinaryControlItem }) {
  const { t } = useTranslation();
  const probeRows = [
    ["P_Syn", item.synonym, "P_Syn"],
    ["P_Comp", item.component, "P_Comp"],
    ["P_WordsSyn", item.word_by_word, "P_WordsSyn"],
    ["P_Rand", item.random, "P_Rand"],
  ] as const;
  return (
    <details className="group rounded-2xl border border-[#d5d1c5] bg-white/70 open:bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 marker:hidden">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl text-[#183331]">{item.name}</h2>
          <p className="mt-1 text-sm text-[#5d6964]">{item.original}</p>
        </div>
        <ClassPill value={item.group} />
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d1cdc1] text-lg transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-[#e2ded3] p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {probeRows.map(([kind, value, noteKey]) => (
            <div key={kind} className="rounded-xl bg-[#f5f3ec] p-4">
              <p className="font-mono text-[10px] font-bold text-[#8e5c45]">
                {kind}
              </p>
              <p className="mt-2 font-serif text-xl">{value}</p>
              <p className="mt-2 text-xs leading-5 text-[#6a746f]">
                {t(`public.dataset.controlCard.probeNotes.${noteKey}`)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[#e0d6bd] bg-[#fff9e9] p-4 text-xs leading-5 text-[#6c5c34]">
          {t("public.dataset.controlCard.curationStatus", {
            review: item.review_status,
            semantic: item.semantic_review_status,
            grammar: item.grammar_review_status,
            frequency: item.frequency_match_status,
          })}
        </div>
      </div>
    </details>
  );
}

export function PublicDataset() {
  const { t } = useTranslation();
  const {
    loading: authLoading,
    firebaseUser,
    isAnonymous,
    publicSessionError,
  } = useAuth();
  const [language, setLanguage] = useState<PublicLanguage>("EN");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const dataset = useQuery({
    queryKey: ["public-dataset", language],
    queryFn: () => loadPublicDataset(language),
    enabled: !!firebaseUser,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const languages = useMemo(
    () =>
      languageKeys.map((key) => ({
        key,
        label: t(`public.dataset.languages.${key}.label`),
        caption: t(`public.dataset.languages.${key}.caption`),
      })),
    [t],
  );

  useEffect(() => {
    setPage(1);
    setSearch("");
    setClassFilter("all");
  }, [language]);
  useEffect(() => {
    setPage(1);
  }, [search, classFilter]);

  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    return [...(dataset.data?.items ?? [])]
      .filter(
        (item) =>
          (!needle || searchableText(item).includes(needle)) &&
          (classFilter === "all" || itemClass(item) === classFilter),
      )
      .sort((a, b) =>
        itemName(a).localeCompare(
          itemName(b),
          language === "TR" || language === "CTRL"
            ? "tr"
            : language === "PT"
              ? "pt"
              : "en",
        ),
      );
  }, [dataset.data, search, classFilter, language]);
  const classOptions = useMemo(
    () => [...new Set((dataset.data?.items ?? []).map(itemClass))].sort(),
    [dataset.data],
  );
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2e9] text-sm text-[#53605b]">
        {t("public.dataset.authLoading")}
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[#f5f2e9]">
        <PublicHeader compact />
        <main className="mx-auto max-w-2xl px-6 py-24">
          <div className="rounded-3xl border border-[#dfb9ad] bg-white p-8">
            <LockKeyhole className="h-9 w-9 text-[#a8503c]" />
            <h1 className="mt-6 font-serif text-4xl">
              {t("public.dataset.sessionFailed.title")}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#5c6863]">
              {t("public.dataset.sessionFailed.description")}
            </p>
            {publicSessionError ? (
              <p className="mt-4 rounded-xl bg-[#fff0ec] p-3 font-mono text-xs text-[#8d4839]">
                {publicSessionError}
              </p>
            ) : null}
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 font-bold text-[#28594f]"
            >
              <ArrowLeft className="h-4 w-4" /> {t("public.dataset.backToHome")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f2e9] text-[#172b29]">
      <PublicHeader compact />
      <main className="mx-auto max-w-[1480px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#5b6963] hover:text-[#1f4b43]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />{" "}
                {t("public.dataset.backToAtlas")}
              </Link>
              <LanguageSwitcher className="border-[#b9c7c0] bg-white/70" />
            </div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#9b5c3f]">
              {t("public.dataset.eyebrow")}
            </p>
            <h1 className="mt-3 font-serif text-4xl tracking-[-.035em] sm:text-5xl">
              {t("public.dataset.title")}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#58655f]">
              {t("public.dataset.description")}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#bed0c7] bg-[#e8f1ec] p-4 text-xs text-[#315c50]">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <div>
              <b>
                {isAnonymous
                  ? t("public.dataset.sessionBanner.anonymous")
                  : t("public.dataset.sessionBanner.authenticated")}
              </b>
              <p className="mt-1 text-[10px] opacity-80">
                {t("public.dataset.sessionBanner.readOnly")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {languages.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setLanguage(entry.key)}
              className={`rounded-2xl border p-4 text-left transition ${language === entry.key ? "border-[#1f4c44] bg-[#173532] text-white shadow-lg" : "border-[#d6d2c6] bg-white/60 hover:bg-white"}`}
            >
              <p className="font-serif text-xl">{entry.label}</p>
              <p
                className={`mt-1 text-[10px] uppercase tracking-wider ${language === entry.key ? "text-[#bcd0c7]" : "text-[#7b847f]"}`}
              >
                {entry.caption}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[#d6d2c6] bg-white/65 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_230px_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78827d]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#d2cec2] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#4e756b]"
                placeholder={t("public.dataset.searchPlaceholder")}
              />
            </label>
            <label className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78827d]" />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-[#d2cec2] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#4e756b]"
              >
                <option value="all">{t("public.dataset.allClasses")}</option>
                {classOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-[#eeece4] px-4 py-2 text-xs">
              <span>
                <b>{items.length}</b> / {dataset.data?.items.length ?? 0}{" "}
                {t("public.dataset.records")}
              </span>
              <span className="font-mono text-[9px] uppercase text-[#78827d]">
                {dataset.data?.source === "firestore-publication"
                  ? t("public.dataset.sourceFirestore")
                  : t("public.dataset.sourceBundled")}
              </span>
            </div>
          </div>
        </div>

        {dataset.isLoading ? (
          <div className="grid min-h-[420px] place-items-center text-sm text-[#65716b]">
            <Database className="mb-3 h-7 w-7 animate-pulse" />
            {t("public.dataset.loading")}
          </div>
        ) : dataset.error ? (
          <div className="mt-6 rounded-2xl border border-[#e2b9ae] bg-[#fff0ec] p-5 text-sm text-[#88483a]">
            {dataset.error instanceof Error
              ? dataset.error.message
              : t("common.unknownError")}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {pageItems.map((item) =>
              isControl(item) ? (
                <ControlCard key={item.item_id} item={item} />
              ) : isTurkishMwe(item) ? (
                <TurkishCard key={item.id} item={item} />
              ) : isReferenceMwe(item) ? (
                <ReferenceCard key={item.id} item={item} />
              ) : null,
            )}
            {pageItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c9c5b9] p-12 text-center text-sm text-[#6b756f]">
                {t("public.dataset.noMatches")}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#d8d4c8] pt-6">
          <p className="text-xs text-[#69746f]">
            {t("public.dataset.pagination", { page, pageCount, pageSize })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[#c9c5b9] bg-white px-4 text-xs font-bold disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />{" "}
              {t("public.dataset.previous")}
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#173532] px-4 text-xs font-bold text-white disabled:opacity-40"
            >
              {t("public.dataset.next")}{" "}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
