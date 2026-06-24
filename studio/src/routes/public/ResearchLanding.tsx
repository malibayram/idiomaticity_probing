import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  CircleAlert,
  Database,
  ExternalLink,
  FlaskConical,
  Gauge,
  Languages,
  LockKeyhole,
  Network,
  Quote,
  Scale,
  Sparkles,
} from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { loadReferenceDatasetIndex } from "@/data/repository";
import { useRunIndicators, type CalibrationRow, type DiagnosticRow } from "@/lib/results-data";

const PROBE_KEYS = ["P_Syn", "P_Comp", "P_WordsSyn", "P_Rand"] as const;

const PROBE_META: Record<(typeof PROBE_KEYS)[number], { value: string; score: number; tone: string }> = {
  P_Syn: { value: "brain", score: 0.55, tone: "#2f7d6d" },
  P_Comp: { value: "matter", score: 0.78, tone: "#d8644a" },
  P_WordsSyn: { value: "silvery material", score: 0.64, tone: "#d99538" },
  P_Rand: { value: "battlefront serviceman", score: 0.47, tone: "#71847d" },
};

const METRIC_KEYS = ["S", "A", "SR", "ISC", "IG", "LOD", "AID", "FLOOR", "RHO", "ICS", "OCG"] as const;

const EXPERIMENT_NOS = ["01", "02", "03", "04"] as const;

const EXPERIMENT_COLORS: Record<(typeof EXPERIMENT_NOS)[number], string> = {
  "01": "#3f6f65",
  "02": "#4b6e92",
  "03": "#755b93",
  "04": "#a65d45",
};

const SOURCE_HREFS = [
  "https://doi.org/10.1162/coli_a_00546",
  "https://github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations",
  "https://github.com/coltekin/turkish-idioms",
  "https://tatoeba.org/tr/downloads",
  "https://github.com/StarlangSoftware/TurkishWordNet",
  "https://sozluk.gov.tr/",
] as const;

type SourceTraceItem = { title: string; role: string; license: string; status: string };

type IcsChartLabels = {
  empty: string;
  ariaLabel: string;
  chartTitle: string;
  partialThreshold: string;
  tooltipFloor: string;
};

type OcgChartLabels = {
  empty: string;
  legendIdiom: string;
  legendCompositional: string;
  ariaLabel: string;
  chartTitle: string;
  ordinaryBaseline: string;
  tooltipIdiom: string;
  tooltipCompositional: string;
};

const SECTION_IDS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;
type SectionId = (typeof SECTION_IDS)[number];

function SectionLabel({ id }: { id: SectionId }) {
  const { t } = useTranslation();
  return (
    <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#9b5c3f]">
      {t(`public.landing.sections.${id}.label`)}
    </p>
  );
}

function IcsChart({ rows, labels }: { rows: DiagnosticRow[]; labels: IcsChartLabels }) {
  const width = 1200;
  const height = 520;
  const left = 54;
  const right = 24;
  const top = 30;
  const bottom = 150;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const min = 0.25;
  const max = 0.72;
  const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const slot = plotWidth / Math.max(1, rows.length);
  const barWidth = Math.min(30, slot * 0.64);
  const ticks = [0.3, 0.4, 0.5, 0.55, 0.6, 0.7];
  if (!rows.length) {
    return <p className="grid h-[420px] place-items-center text-sm text-[#69746f]">{labels.empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <svg role="img" aria-label={labels.ariaLabel} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[940px]">
        <title>{labels.chartTitle}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0.55 ? "#c74f3b" : "#e5e0d5"}
              strokeDasharray={tick === 0.55 ? "8 6" : undefined}
              strokeWidth={tick === 0.55 ? 2 : 1}
            />
            <text x={left - 9} y={y(tick) + 4} textAnchor="end" fontSize="11" fill={tick === 0.55 ? "#9b3f2f" : "#66736d"}>
              {tick.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={width - right} y={y(0.55) - 8} textAnchor="end" fontSize="11" fontWeight="700" fill="#9b3f2f">
          {labels.partialThreshold}
        </text>
        {rows.map((row, index) => {
          const value = row.ics ?? min;
          const x = left + index * slot + (slot - barWidth) / 2;
          const barY = y(value);
          const color = row.anisotropyWarning
            ? "#d99538"
            : row.studyExperiment === 3
              ? "#755b93"
              : row.studyExperiment === 2
                ? "#4b6e92"
                : "#3f6f65";
          return (
            <g key={`${row.model}-${index}`}>
              <title>
                {row.model}: ICS {value.toFixed(3)}
                {row.anisotropyWarning ? labels.tooltipFloor : ""}
              </title>
              <rect x={x} y={barY} width={barWidth} height={top + plotHeight - barY} rx="4" fill={color} />
              <text transform={`translate(${x + barWidth / 2},${top + plotHeight + 12}) rotate(55)`} textAnchor="start" fontSize="10" fill="#52605a">
                {row.model}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function OcgChart({ rows, labels }: { rows: CalibrationRow[]; labels: OcgChartLabels }) {
  const width = 1200;
  const height = 520;
  const left = 54;
  const right = 24;
  const top = 30;
  const bottom = 150;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const min = -0.2;
  const max = 1.8;
  const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const slot = plotWidth / Math.max(1, rows.length);
  const barWidth = Math.min(16, slot * 0.3);
  const ticks = [-0.2, 0, 0.5, 1, 1.5];
  const zero = y(0);
  if (!rows.length) {
    return <p className="grid h-[420px] place-items-center text-sm text-[#69746f]">{labels.empty}</p>;
  }
  return (
    <>
      <div className="mt-4 flex gap-5 text-[11px] text-[#52605a]">
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-sm bg-[#b65f47]" /> {labels.legendIdiom}
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-sm bg-[#4b7b6e]" /> {labels.legendCompositional}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg role="img" aria-label={labels.ariaLabel} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[940px]">
          <title>{labels.chartTitle}</title>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 1 ? "#40534b" : "#e5e0d5"}
                strokeDasharray={tick === 1 ? "8 6" : undefined}
                strokeWidth={tick === 1 ? 2 : 1}
              />
              <text x={left - 9} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#66736d">
                {tick.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={width - right} y={y(1) - 8} textAnchor="end" fontSize="11" fontWeight="700" fill="#40534b">
            {labels.ordinaryBaseline}
          </text>
          {rows.map((row, index) => {
            const center = left + index * slot + slot / 2;
            const values = [
              { value: row.ocgIdiom ?? 0, color: "#b65f47", x: center - barWidth - 1, kind: labels.tooltipIdiom },
              { value: row.ocgCompositional ?? 0, color: "#4b7b6e", x: center + 1, kind: labels.tooltipCompositional },
            ];
            return (
              <g key={`${row.model}-${index}`}>
                {values.map((entry, series) => {
                  const valueY = y(entry.value);
                  return (
                    <rect
                      key={series}
                      x={entry.x}
                      y={Math.min(valueY, zero)}
                      width={barWidth}
                      height={Math.max(1, Math.abs(zero - valueY))}
                      rx="3"
                      fill={entry.color}
                    >
                      <title>
                        {row.model}: {entry.kind} OCG {entry.value.toFixed(3)}
                      </title>
                    </rect>
                  );
                })}
                <text transform={`translate(${center},${top + plotHeight + 12}) rotate(55)`} textAnchor="start" fontSize="10" fill="#52605a">
                  {row.model}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

function PublicFooter() {
  const { t, i18n } = useTranslation();
  const applyLabel = i18n.language.startsWith("tr") ? "İşaretleyici ol" : "Become an annotator";
  return (
    <footer className="border-t border-[#d8d4c8] bg-[#132b2b] text-[#dbe6df]">
      <div className="mx-auto grid max-w-[1480px] gap-8 px-6 py-12 lg:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <p className="font-serif text-2xl text-white">{t("public.landing.footer.title")}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9bbb3]">{t("public.landing.footer.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10" href="https://doi.org/10.1162/coli_a_00546" target="_blank" rel="noreferrer">
            {t("public.landing.footer.originalPaper")} <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
          <Link className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10" to="/dataset">
            {t("public.landing.footer.openExplorer")}
          </Link>
          <Link className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10" to="/apply">
            {applyLabel}
          </Link>
          <Link className="rounded-full bg-[#f4c95d] px-4 py-2 font-bold text-[#132b2b]" to="/login">
            {t("public.landing.footer.annotatorLogin")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function ResearchLanding() {
  const { t } = useTranslation();
  const results = useRunIndicators();
  const overview = useQuery({
    queryKey: ["public-research-overview"],
    queryFn: loadReferenceDatasetIndex,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const enDiagnostics = useMemo(
    () =>
      (results.data?.diagnostics ?? [])
        .filter((row) => row.language === "EN" && row.ics !== null)
        .sort((a, b) => (b.ics ?? 0) - (a.ics ?? 0)),
    [results.data],
  );
  const calibration = useMemo(
    () =>
      (results.data?.calibration ?? [])
        .filter((row) => row.ocgIdiom !== null)
        .sort((a, b) => (b.ocgIdiom ?? 0) - (a.ocgIdiom ?? 0)),
    [results.data],
  );

  const icsChartLabels = useMemo<IcsChartLabels>(
    () => ({
      empty: t("public.landing.sections.06.icsChart.empty"),
      ariaLabel: t("public.landing.sections.06.icsChart.ariaLabel"),
      chartTitle: t("public.landing.sections.06.icsChart.chartTitle"),
      partialThreshold: t("public.landing.sections.06.icsChart.partialThreshold"),
      tooltipFloor: t("public.landing.sections.06.icsChart.tooltipFloor"),
    }),
    [t, enDiagnostics, calibration, results.isLoading],
  );

  const ocgChartLabels = useMemo<OcgChartLabels>(
    () => ({
      empty: t("public.landing.sections.06.ocgChart.empty"),
      legendIdiom: t("public.landing.sections.06.ocgChart.legendIdiom"),
      legendCompositional: t("public.landing.sections.06.ocgChart.legendCompositional"),
      ariaLabel: t("public.landing.sections.06.ocgChart.ariaLabel"),
      chartTitle: t("public.landing.sections.06.ocgChart.chartTitle"),
      ordinaryBaseline: t("public.landing.sections.06.ocgChart.ordinaryBaseline"),
      tooltipIdiom: t("public.landing.sections.06.ocgChart.tooltipIdiom"),
      tooltipCompositional: t("public.landing.sections.06.ocgChart.tooltipCompositional"),
    }),
    [t, enDiagnostics, calibration, results.isLoading],
  );

  const sourceTrace = t("public.landing.sourceTrace", { returnObjects: true }) as SourceTraceItem[];

  const originalBullets = t("public.landing.sections.02.original.bullets", { returnObjects: true }) as string[];
  const newDraftBullets = t("public.landing.sections.02.newDraft.bullets", { returnObjects: true }) as string[];

  const limitations = t("public.landing.sections.08.limitations", { returnObjects: true }) as { title: string; text: string }[];
  const pipelineSteps = t("public.landing.sections.08.pipeline.steps", { returnObjects: true }) as string[];

  const section07Stats = t("public.landing.sections.07.stats", { returnObjects: true }) as { value: string; label: string }[];

  const workedExampleLines = t("public.landing.sections.04.workedExample.lines", { returnObjects: true }) as string[];

  const enSummary = overview.data?.summary.EN;
  const ptSummary = overview.data?.summary.PT;
  const trCount = 280;

  const section01Cards = [
    ["representation", Network],
    ["comparative", Scale],
    ["crossLingual", Languages],
    ["modelAgnostic", FlaskConical],
  ] as const;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f2e9] text-[#172b29] selection:bg-[#f4c95d]/70">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-[#d8d4c8]">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,#c9c5b8_1px,transparent_1px),linear-gradient(to_bottom,#c9c5b8_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto grid w-full min-w-0 max-w-[1480px] gap-12 px-6 py-20 lg:grid-cols-[1.15fr_.85fr] lg:px-10 lg:py-28">
            <div className="min-w-0">
              <div className="mb-8 grid max-w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <span className="rounded-full border border-[#9bb1a7] bg-white/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                  {t("public.landing.hero.badges.years")}
                </span>
                <span className="rounded-full border border-[#d8b89e] bg-white/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                  {t("public.landing.hero.badges.languages")}
                </span>
                <span className="col-span-2 w-fit rounded-full border border-[#cabd81] bg-[#f4c95d]/20 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] sm:col-span-1">
                  {t("public.landing.hero.badges.models")}
                </span>
              </div>
              <h1 className="max-w-full break-words font-serif text-[42px] leading-[0.98] tracking-[-0.045em] text-[#132b2b] sm:text-6xl lg:text-[78px]">
                {t("public.landing.hero.title")}{" "}
                <em className="font-normal text-[#a8503c]">{t("public.landing.hero.titleEmphasis")}</em>{" "}
                {t("public.landing.hero.titleSuffix")}
              </h1>
              <p className="mt-8 max-w-full break-words text-lg leading-8 text-[#53605b] sm:max-w-3xl lg:text-xl">
                {t("public.landing.hero.description")}
              </p>
              <div className="mt-10 flex max-w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  to="/dataset"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#132b2b] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(19,43,43,.18)] hover:bg-[#1d403e] sm:w-auto"
                >
                  {t("public.landing.hero.ctaExplore")} <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#metrikler"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#a9b9b1] bg-white/70 px-6 py-3 text-sm font-bold text-[#183c3a] hover:bg-white sm:w-auto"
                >
                  {t("public.landing.hero.ctaMetrics")}
                </a>
              </div>
            </div>

            <div className="min-w-0 self-end rounded-[28px] border border-[#c9c5b8] bg-[#fbfaf5]/90 p-5 shadow-[0_24px_80px_rgba(38,48,43,.12)] sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#77817c]">{t("public.landing.hero.demo.eyebrow")}</p>
                  <p className="mt-1 font-serif text-2xl">{t("public.landing.hero.demo.prompt")}</p>
                </div>
                <Gauge className="h-8 w-8 text-[#a8503c]" />
              </div>
              <p className="rounded-xl bg-[#eef1eb] p-4 text-sm leading-6">{t("public.landing.hero.demo.sentence")}</p>
              <div className="mt-5 space-y-4">
                {PROBE_KEYS.map((key) => {
                  const meta = PROBE_META[key];
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span>
                          <b className="font-mono">{key}</b> · {meta.value}
                        </span>
                        <b>{meta.score.toFixed(2)}</b>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#e5e3da]">
                        <div className="h-full rounded-full" style={{ width: `${meta.score * 100}%`, backgroundColor: meta.tone }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex gap-3 rounded-xl border border-[#e3c1b7] bg-[#fff3ee] p-4 text-sm leading-6 text-[#744537]">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{t("public.landing.hero.demo.alert")}</span>
              </div>
            </div>
          </div>
        </section>

        <section id="amac" className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
          <SectionLabel id="01" />
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <h2 className="font-serif text-4xl leading-tight tracking-[-.03em] sm:text-5xl">{t("public.landing.sections.01.heading")}</h2>
              <p className="mt-6 text-base leading-7 text-[#58655f]">{t("public.landing.sections.01.paragraph")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {section01Cards.map(([key, Icon]) => (
                <article key={key} className="rounded-2xl border border-[#d6d2c5] bg-white/60 p-6">
                  <Icon className="h-6 w-6 text-[#9b5c3f]" />
                  <h3 className="mt-5 font-bold">{t(`public.landing.sections.01.cards.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5b6862]">{t(`public.landing.sections.01.cards.${key}.text`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#d8d4c8] bg-[#e9eee9]">
          <div className="mx-auto max-w-[1480px] px-6 py-16 lg:px-10">
            <SectionLabel id="02" />
            <div className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-[24px] bg-[#f9faf6] p-7 lg:p-9">
                <div className="flex items-start justify-between gap-4">
                  <BookOpen className="h-8 w-8 text-[#38685f]" />
                  <span className="font-mono text-xs text-[#6f7c76]">{t("public.landing.sections.02.original.venue")}</span>
                </div>
                <h3 className="mt-8 font-serif text-3xl">{t("public.landing.sections.02.original.title")}</h3>
                <p className="mt-4 text-sm leading-7 text-[#53605b]">{t("public.landing.sections.02.original.description")}</p>
                <ul className="mt-6 space-y-2 text-sm text-[#42514b]">
                  {originalBullets.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-[#397766]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#28594f] hover:underline"
                  href="https://doi.org/10.1162/coli_a_00546"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("public.landing.sections.02.original.link")} <ExternalLink className="h-4 w-4" />
                </a>
              </article>
              <article className="rounded-[24px] bg-[#132b2b] p-7 text-white lg:p-9">
                <div className="flex items-start justify-between gap-4">
                  <Sparkles className="h-8 w-8 text-[#f4c95d]" />
                  <span className="font-mono text-xs text-[#9db2aa]">{t("public.landing.sections.02.newDraft.badge")}</span>
                </div>
                <h3 className="mt-8 font-serif text-3xl">{t("public.landing.sections.02.newDraft.title")}</h3>
                <p className="mt-4 text-sm leading-7 text-[#c3d0ca]">{t("public.landing.sections.02.newDraft.description")}</p>
                <ul className="mt-6 space-y-2 text-sm text-[#d7e1dc]">
                  {newDraftBullets.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-[#f4c95d]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="yontem" className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
          <SectionLabel id="03" />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h2 className="font-serif text-4xl tracking-[-.03em] sm:text-5xl">{t("public.landing.sections.03.heading")}</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#58655f]">{t("public.landing.sections.03.paragraph")}</p>
            </div>
            <Link to="/dataset" className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#9b4d39] hover:underline">
              {t("public.landing.sections.03.linkAllRecords")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {PROBE_KEYS.map((key, index) => {
              const meta = PROBE_META[key];
              return (
                <article key={key} className="relative overflow-hidden rounded-2xl border border-[#d6d2c5] bg-white/65 p-6">
                  <span className="absolute right-4 top-3 font-serif text-5xl text-[#e5e1d7]">{index + 1}</span>
                  <p className="font-mono text-xs font-bold" style={{ color: meta.tone }}>
                    {key}
                  </p>
                  <h3 className="mt-4 font-serif text-2xl">{t(`public.landing.probes.${key}.label`)}</h3>
                  <p className="mt-2 font-mono text-sm text-[#263d39]">{t("public.landing.sections.03.probeArrow", { value: meta.value })}</p>
                  <p className="mt-5 text-sm leading-6 text-[#5a6761]">{t(`public.landing.probes.${key}.note`)}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-12 overflow-hidden rounded-[24px] border border-[#cfccbf] bg-[#fbfaf6]">
            <div className="grid md:grid-cols-4">
              {(
                [
                  {
                    lang: "EN",
                    count: enSummary?.officialPaperMweCount ?? 280,
                    total: "19,600",
                    detail: t("public.landing.sections.03.dataGrid.EN.detail", {
                      natural: enSummary?.naturalContextCount ?? 840,
                      neutral: enSummary?.neutralContextCount ?? 560,
                    }),
                  },
                  {
                    lang: "PT",
                    count: ptSummary?.officialPaperMweCount ?? 180,
                    total: "12,600",
                    detail: t("public.landing.sections.03.dataGrid.PT.detail", {
                      natural: ptSummary?.naturalContextCount ?? 540,
                      neutral: ptSummary?.neutralContextCount ?? 360,
                    }),
                  },
                  {
                    lang: "TR",
                    count: trCount,
                    total: t("public.landing.sections.03.dataGrid.TR.total"),
                    detail: t("public.landing.sections.03.dataGrid.TR.detail"),
                  },
                  {
                    lang: "CTRL",
                    count: 64,
                    total: t("public.landing.sections.03.dataGrid.CTRL.total"),
                    detail: t("public.landing.sections.03.dataGrid.CTRL.detail"),
                  },
                ] as const
              ).map(({ lang, count, total, detail }) => (
                <div
                  key={lang}
                  className="border-b border-[#dedace] p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <p className="font-mono text-xs font-bold text-[#9b5c3f]">{lang}</p>
                  <p className="mt-3 font-serif text-4xl">{count}</p>
                  <p className="mt-1 text-sm font-bold">
                    {total} {t("public.landing.sections.03.dataGrid.sentenceSuffix")}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#69746f]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-3 rounded-xl border border-[#dfcfa7] bg-[#fff9e8] p-4 text-xs leading-5 text-[#6c5b31]">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <p>{t("public.landing.sections.03.auditNote")}</p>
          </div>
        </section>

        <section id="metrikler" className="border-y border-[#d8d4c8] bg-[#172f2e] text-white">
          <div className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
            <SectionLabel id="04" />
            <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
              <div>
                <h2 className="font-serif text-4xl tracking-[-.03em] sm:text-5xl">{t("public.landing.sections.04.heading")}</h2>
                <p className="mt-6 text-base leading-7 text-[#b9c9c2]">{t("public.landing.sections.04.paragraph")}</p>
                <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5">
                  <p className="font-mono text-xs uppercase tracking-[.16em] text-[#f4c95d]">{t("public.landing.sections.04.workedExample.label")}</p>
                  {workedExampleLines.map((line, lineIndex) => (
                    <p
                      key={line}
                      className={
                        lineIndex === 0
                          ? "mt-3 text-sm leading-6 text-[#d6e0dc]"
                          : "mt-2 font-mono text-sm text-white"
                      }
                    >
                      {line}
                    </p>
                  ))}
                  <p className="mt-2 text-xs leading-5 text-[#9fb3ab]">{t("public.landing.sections.04.workedExample.note")}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {METRIC_KEYS.map((key) => (
                  <article key={key} className="rounded-2xl border border-white/12 bg-white/[.055] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-lg font-bold text-[#f4c95d]">{key === "SR" ? "Sᴿ" : key}</span>
                        <h3 className="mt-1 text-sm font-bold">{t(`public.landing.metrics.${key}.name`)}</h3>
                      </div>
                      <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] uppercase tracking-wider text-[#a9bbb3]">
                        {t(`public.landing.metrics.${key}.direction`)}
                      </span>
                    </div>
                    <p className="mt-4 font-mono text-[11px] leading-5 text-[#b7c9c1]">{t(`public.landing.metrics.${key}.formula`)}</p>
                    <p className="mt-3 text-xs leading-5 text-[#d7e0dc]">{t(`public.landing.metrics.${key}.explanation`)}</p>
                    <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-[#9fb3ab]">{t(`public.landing.metrics.${key}.example`)}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="deneyler" className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
          <SectionLabel id="05" />
          <h2 className="max-w-4xl font-serif text-4xl tracking-[-.03em] sm:text-5xl">{t("public.landing.sections.05.heading")}</h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {EXPERIMENT_NOS.map((no) => (
              <article key={no} className="rounded-[24px] border border-[#d4d0c3] bg-white/60 p-7">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-5xl" style={{ color: EXPERIMENT_COLORS[no] }}>
                    {no}
                  </span>
                  <span className="rounded-full border border-[#d7d3c7] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#67736d]">
                    {t(`public.landing.experiments.${no}.scope`)}
                  </span>
                </div>
                <h3 className="mt-7 font-serif text-3xl">{t(`public.landing.experiments.${no}.title`)}</h3>
                <p className="mt-4 text-sm font-bold leading-6 text-[#334a44]">{t(`public.landing.experiments.${no}.question`)}</p>
                <p className="mt-4 border-l-2 pl-4 text-sm leading-6 text-[#5c6963]" style={{ borderColor: EXPERIMENT_COLORS[no] }}>
                  {t(`public.landing.experiments.${no}.result`)}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[#d4d0c3] bg-[#fbfaf6] p-7">
              <div className="flex items-center gap-3">
                <Braces className="h-6 w-6 text-[#8e5b46]" />
                <h3 className="font-serif text-2xl">{t("public.landing.sections.05.representation.title")}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#58655f]">{t("public.landing.sections.05.representation.text")}</p>
            </div>
            <div className="rounded-[24px] border border-[#d4d0c3] bg-[#fbfaf6] p-7">
              <div className="flex items-center gap-3">
                <CircleAlert className="h-6 w-6 text-[#b86148]" />
                <h3 className="font-serif text-2xl">{t("public.landing.sections.05.anisotropy.title")}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#58655f]">{t("public.landing.sections.05.anisotropy.text")}</p>
            </div>
          </div>
        </section>

        <section id="bulgular" className="border-y border-[#d8d4c8] bg-[#ece8dc]">
          <div className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
            <SectionLabel id="06" />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl bg-[#132b2b] p-7 text-white">
                <p className="font-mono text-xs uppercase tracking-wider text-[#f4c95d]">{t("public.landing.sections.06.stats.bestIcs.label")}</p>
                <p className="mt-4 font-serif text-6xl">{t("public.landing.sections.06.stats.bestIcs.value")}</p>
                <p className="mt-3 text-sm leading-6 text-[#b8c8c1]">{t("public.landing.sections.06.stats.bestIcs.note")}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-7">
                <p className="font-mono text-xs uppercase tracking-wider text-[#9b5c3f]">{t("public.landing.sections.06.stats.bestOcg.label")}</p>
                <p className="mt-4 font-serif text-6xl">{t("public.landing.sections.06.stats.bestOcg.value")}</p>
                <p className="mt-3 text-sm leading-6 text-[#5b6862]">{t("public.landing.sections.06.stats.bestOcg.note")}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-7">
                <p className="font-mono text-xs uppercase tracking-wider text-[#9b5c3f]">{t("public.landing.sections.06.stats.threshold.label")}</p>
                <p className="mt-4 font-serif text-6xl">{t("public.landing.sections.06.stats.threshold.value")}</p>
                <p className="mt-3 text-sm leading-6 text-[#5b6862]">{t("public.landing.sections.06.stats.threshold.note")}</p>
              </div>
            </div>

            <div className="mt-8 rounded-[24px] border border-[#d1cdc0] bg-[#fbfaf6] p-4 sm:p-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="font-serif text-2xl">{t("public.landing.sections.06.icsChart.title")}</h3>
                  <p className="mt-1 text-xs text-[#67736d]">{t("public.landing.sections.06.icsChart.subtitle")}</p>
                </div>
                <span className="text-[10px] text-[#7b847f]">{t("public.landing.sections.06.icsChart.anisotropyWarning")}</span>
              </div>
              {results.isLoading ? (
                <div className="grid h-[430px] place-items-center text-sm text-[#69746f]">{t("public.landing.sections.06.icsChart.loading")}</div>
              ) : (
                <IcsChart rows={enDiagnostics} labels={icsChartLabels} />
              )}
            </div>
            <div className="mt-6 rounded-[24px] border border-[#d1cdc0] bg-[#fbfaf6] p-4 sm:p-7">
              <h3 className="font-serif text-2xl">{t("public.landing.sections.06.ocgChart.title")}</h3>
              <p className="mt-1 text-xs text-[#67736d]">{t("public.landing.sections.06.ocgChart.subtitle")}</p>
              {results.isLoading ? (
                <div className="grid h-[430px] place-items-center text-sm text-[#69746f]">{t("public.landing.sections.06.ocgChart.loading")}</div>
              ) : (
                <OcgChart rows={calibration} labels={ocgChartLabels} />
              )}
            </div>

            <blockquote className="mt-10 grid gap-5 rounded-[24px] bg-[#a8503c] p-8 text-white lg:grid-cols-[auto_1fr]">
              <Quote className="h-10 w-10 text-[#f4c95d]" />
              <div>
                <p className="font-serif text-2xl leading-9 sm:text-3xl">{t("public.landing.sections.06.quote.text")}</p>
                <p className="mt-4 text-sm text-[#f3d7cf]">{t("public.landing.sections.06.quote.attribution")}</p>
              </div>
            </blockquote>
          </div>
        </section>

        <section className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
          <SectionLabel id="07" />
          <div className="grid gap-8 lg:grid-cols-[1fr_.9fr]">
            <div>
              <h2 className="font-serif text-4xl tracking-[-.03em] sm:text-5xl">{t("public.landing.sections.07.heading")}</h2>
              <p className="mt-6 max-w-3xl text-base leading-7 text-[#58655f]">{t("public.landing.sections.07.paragraph")}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {section07Stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-[#d4d0c3] bg-white/60 p-5">
                    <p className="font-serif text-3xl">{stat.value}</p>
                    <p className="mt-1 text-xs text-[#67736d]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[#c9c5b8] bg-[#fbfaf6] p-7">
              <LockKeyhole className="h-8 w-8 text-[#38685f]" />
              <h3 className="mt-6 font-serif text-3xl">{t("public.landing.sections.07.openData.title")}</h3>
              <p className="mt-4 text-sm leading-7 text-[#58655f]">{t("public.landing.sections.07.openData.description")}</p>
              <Link to="/dataset" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#132b2b] px-5 py-3 text-sm font-bold text-white">
                {t("public.landing.sections.07.openData.cta")} <Database className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="seffaflik" className="border-t border-[#d8d4c8] bg-[#e9eee9]">
          <div className="mx-auto max-w-[1480px] px-6 py-20 lg:px-10 lg:py-28">
            <SectionLabel id="08" />
            <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr]">
              <div>
                <h2 className="font-serif text-4xl tracking-[-.03em] sm:text-5xl">{t("public.landing.sections.08.heading")}</h2>
                <p className="mt-6 text-base leading-7 text-[#58655f]">{t("public.landing.sections.08.paragraph")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {limitations.map((item) => (
                  <article key={item.title} className="rounded-2xl border border-[#d2cec1] bg-[#fbfaf6] p-5">
                    <CircleAlert className="h-5 w-5 text-[#a8503c]" />
                    <h3 className="mt-4 text-sm font-bold">{item.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-[#5d6964]">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-12 rounded-[24px] border border-[#cecabe] bg-[#fbfaf6] p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[.65fr_1.35fr]">
                <div>
                  <h3 className="font-serif text-3xl">{t("public.landing.sections.08.pipeline.title")}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5b6862]">{t("public.landing.sections.08.pipeline.description")}</p>
                </div>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {pipelineSteps.map((step) => (
                    <li key={step} className="rounded-xl border border-[#ded9cc] bg-white px-4 py-3 text-xs font-bold text-[#3e514b]">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-[24px] border border-[#cecabe] bg-[#fbfaf6]">
              <div className="border-b border-[#ddd8cc] p-6 lg:p-8">
                <h3 className="font-serif text-3xl">{t("public.landing.sections.08.sources.title")}</h3>
                <p className="mt-2 text-sm text-[#65716b]">{t("public.landing.sections.08.sources.description")}</p>
              </div>
              <div className="divide-y divide-[#e2ded3]">
                {sourceTrace.map((source, index) => (
                  <a
                    key={source.title}
                    href={SOURCE_HREFS[index]}
                    target="_blank"
                    rel="noreferrer"
                    className="grid gap-3 p-5 hover:bg-white sm:grid-cols-[1.1fr_1.6fr_.8fr_.65fr_auto] sm:items-center lg:px-8"
                  >
                    <span className="text-sm font-bold text-[#1d3d38]">{source.title}</span>
                    <span className="text-xs leading-5 text-[#5c6963]">{source.role}</span>
                    <span className="text-[11px] font-medium text-[#765342]">{source.license}</span>
                    <span className="w-fit rounded-full bg-[#e7ece7] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#4c625a]">
                      {source.status}
                    </span>
                    <ExternalLink className="h-4 w-4 text-[#7c8782]" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
