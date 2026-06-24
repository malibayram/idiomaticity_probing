import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useFormatNumber, useMetricLabels } from "@/i18n/hooks";
import {
    METRIC_KEYS,
    useRunIndicators,
    type CalibrationRow,
    type DiagnosticRow,
    type IndicatorRow,
    type MetricKey,
} from "@/lib/results-data";
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import ReactECharts from "echarts-for-react";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const fmt = (v: number | null | undefined, d = 3) =>
  v == null ? "-" : v.toFixed(d);

const FAMILY_COLOR: Record<string, string> = {
  encoder: "#2563eb",
  "encoder/emb": "#7c3aed",
  embedding: "#0891b2",
  "decoder LLM": "#16a34a",
};
const familyColor = (f: string) => FAMILY_COLOR[f] ?? "#6b7280";

export function ResultsView() {
  const { t } = useTranslation();
  const metricLabels = useMetricLabels();
  const formatNumber = useFormatNumber();
  const { data, isLoading, isError, error } = useRunIndicators();

  const [experiment, setExperiment] = useState("all");
  const [family, setFamily] = useState("all");
  const [lang, setLang] = useState("EN");
  const [metric, setMetric] = useState<MetricKey>("ics");
  const [xAxis, setXAxis] = useState<MetricKey>("ics");
  const [yAxis, setYAxis] = useState<MetricKey>("floor");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "ics", desc: true },
  ]);

  const indicators = useMemo(() => data?.indicators ?? [], [data]);
  const diagnostics = useMemo(() => data?.diagnostics ?? [], [data]);
  const calibration = useMemo(() => data?.calibration ?? [], [data]);

  const families = useMemo(
    () => [...new Set(diagnostics.map((d) => d.family))].sort(),
    [diagnostics],
  );
  const langs = useMemo(
    () => [...new Set(diagnostics.map((d) => d.language))].sort(),
    [diagnostics],
  );

  // Diagnostics filtered to the chosen language + family (article context-averaged table).
  const diagView = useMemo(
    () =>
      diagnostics.filter(
        (d) =>
          (family === "all" || d.family === family) &&
          (lang === "all" || d.language === lang) &&
          (experiment === "all" || d.studyExperiment === Number(experiment)),
      ),
    [diagnostics, family, lang, experiment],
  );

  // Indicators scoped by family + experiment, shared by scatter and table.
  const indView = useMemo(
    () =>
      indicators.filter(
        (r) =>
          (family === "all" || r.modelType === family) &&
          (experiment === "all" || r.studyExperiment === Number(experiment)),
      ),
    [indicators, family, experiment],
  );

  // Master finding: best ICS across the study, vs capture threshold.
  const best = useMemo(() => {
    let top: DiagnosticRow | null = null;
    for (const d of diagnostics) {
      if (d.ics != null && (!top || d.ics > (top.ics ?? -Infinity))) top = d;
    }
    return top;
  }, [diagnostics]);

  if (isLoading) return <FullPageSpinner label={t("results.loading")} />;
  if (isError || !data)
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("common.dataLoadFailed", {
          message:
            error instanceof Error ? error.message : t("common.unknownError"),
        })}
      </p>
    );

  const {
    thresholds,
    protocolVersion,
    studyModelCount,
    runCount,
    methodNotes,
  } = data;
  const hasTR = langs.includes("TR");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("results.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("results.subtitle", {
            models: formatNumber(studyModelCount),
            runs: formatNumber(runCount),
          })}{" "}
          <Badge variant="primary">{t("results.contextualSpan")}</Badge> ·{" "}
          {t("results.protocol", { version: protocolVersion })}
        </p>
      </div>

      {/* Master finding */}
      <Card className="border-l-4 border-l-[hsl(var(--warning))]">
        <CardHeader>
          <CardTitle>{t("results.masterFinding.title")}</CardTitle>
          <CardDescription>
            {t("results.masterFinding.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {t("results.masterFinding.captureThreshold", {
              capture: thresholds.icsCapture,
              partial: thresholds.icsPartial,
            })}{" "}
            {t("results.masterFinding.highestIcs")}{" "}
            {best ? (
              <strong>
                {best.model} = {fmt(best.ics)} ({best.language})
              </strong>
            ) : (
              "-"
            )}
            .
          </p>
          <p className="text-[hsl(var(--muted-foreground))]">
            {t("results.masterFinding.ordinaryControl", {
              baseline: thresholds.ocgBaseline,
            })}
          </p>
        </CardContent>
      </Card>

      {/* Metric legend */}
      <Card>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 p-4 text-xs">
          {METRIC_KEYS.map((mk) => (
            <span key={mk}>
              <span className="font-semibold">{metricLabels.label(mk)}</span>{" "}
              <span className="text-[hsl(var(--muted-foreground))]">
                {metricLabels.desc(mk)}
              </span>
            </span>
          ))}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={experiment}
          onChange={(e) => setExperiment(e.target.value)}
        >
          <option value="all">{t("results.filters.allExperiments")}</option>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {t(`results.experiments.${n}`)}
            </option>
          ))}
        </Select>
        <Select value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value="all">{t("results.filters.allFamilies")}</option>
          {families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
        <Select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="all">{t("results.filters.allLanguages")}</option>
          {langs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        {!hasTR ? (
          <Badge variant="warning">{t("results.filters.trRunsMissing")}</Badge>
        ) : null}
        <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))]">
          {t("results.filters.modelRows", {
            count: formatNumber(diagView.length),
          })}
        </span>
      </div>

      {/* ICS leaderboard with thresholds */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{t("results.leaderboard.title")}</CardTitle>
            <CardDescription>
              {t("results.leaderboard.description", {
                partial: thresholds.icsPartial,
                capture: thresholds.icsCapture,
              })}
            </CardDescription>
          </div>
          <Select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
          >
            {METRIC_KEYS.map((mk) => (
              <option key={mk} value={mk}>
                {metricLabels.label(mk)}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          <LeaderboardChart
            rows={diagView}
            metric={metric}
            thresholds={thresholds}
          />
        </CardContent>
      </Card>

      {/* Indicator heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>{t("results.heatmap.title")}</CardTitle>
          <CardDescription>
            {t("results.heatmap.description", { lang })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HeatmapChart rows={diagView} />
        </CardContent>
      </Card>

      {/* OCG calibration (Experiment 4) */}
      <Card className="border-l-4 border-l-[hsl(var(--primary))]">
        <CardHeader>
          <CardTitle>{t("results.ocg.title")}</CardTitle>
          <CardDescription>{t("results.ocg.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OcgChart rows={calibration} baseline={thresholds.ocgBaseline} />
          <CalibrationTable rows={calibration} />
        </CardContent>
      </Card>

      {/* Scatter */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{t("results.scatter.title")}</CardTitle>
            <CardDescription>
              {t("results.scatter.description")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value as MetricKey)}
            >
              {METRIC_KEYS.map((mk) => (
                <option key={mk} value={mk}>
                  {t("results.scatter.axisX", {
                    metric: metricLabels.label(mk),
                  })}
                </option>
              ))}
            </Select>
            <Select
              value={yAxis}
              onChange={(e) => setYAxis(e.target.value as MetricKey)}
            >
              {METRIC_KEYS.map((mk) => (
                <option key={mk} value={mk}>
                  {t("results.scatter.axisY", {
                    metric: metricLabels.label(mk),
                  })}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScatterChart rows={indView} xAxis={xAxis} yAxis={yAxis} />
        </CardContent>
      </Card>

      {/* Detailed indicators table */}
      <IndicatorsTable
        rows={indView}
        sorting={sorting}
        setSorting={setSorting}
      />

      {/* Method notes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("results.methodNotes.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[hsl(var(--muted-foreground))]">
            {methodNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LeaderboardChart({
  rows,
  metric,
  thresholds,
}: {
  rows: DiagnosticRow[];
  metric: MetricKey;
  thresholds: { icsPartial: number; icsCapture: number; floorWarning: number };
}) {
  const { t } = useTranslation();
  const metricLabels = useMetricLabels();

  const option = useMemo(() => {
    const sorted = [...rows]
      .filter((r) => r[metric] != null)
      .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
    const labels = sorted.map((r) => `${r.model}·${r.language}`);
    const showThreshold = metric === "ics";
    const showFloorWarn = metric === "floor";
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 48, right: 16, top: 16, bottom: 110 },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { rotate: 45, fontSize: 9 },
      },
      yAxis: { type: "value", name: metricLabels.label(metric) },
      series: [
        {
          type: "bar",
          data: sorted.map((r) => {
            const v = r[metric];
            const warn = r.anisotropyWarning;
            return {
              value: v == null ? null : Number(v.toFixed(3)),
              itemStyle: { color: warn ? "#d97706" : "#2563eb" },
            };
          }),
          markLine: showThreshold
            ? {
                silent: true,
                symbol: "none",
                data: [
                  {
                    yAxis: thresholds.icsPartial,
                    label: { formatter: t("results.charts.partial") },
                    lineStyle: { color: "#d97706" },
                  },
                  {
                    yAxis: thresholds.icsCapture,
                    label: { formatter: t("results.charts.capture") },
                    lineStyle: { color: "#16a34a" },
                  },
                ],
              }
            : showFloorWarn
              ? {
                  silent: true,
                  symbol: "none",
                  data: [
                    {
                      yAxis: thresholds.floorWarning,
                      label: { formatter: t("results.charts.anisotropy") },
                      lineStyle: { color: "#dc2626" },
                    },
                  ],
                }
              : undefined,
        },
      ],
    };
  }, [rows, metric, thresholds, t, metricLabels]);

  if (rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t("common.noData")}
      </p>
    );
  return (
    <ReactECharts option={option} style={{ height: 380 }} notMerge lazyUpdate />
  );
}

function HeatmapChart({ rows }: { rows: DiagnosticRow[] }) {
  const { t } = useTranslation();
  const metricLabels = useMetricLabels();

  const option = useMemo(() => {
    const models = rows.map((r) => `${r.model}·${r.language}`);
    const points: [number, number, number | string][] = [];
    rows.forEach((r, mi) => {
      METRIC_KEYS.forEach((mk, ki) => {
        const v = r[mk];
        points.push([ki, mi, v == null ? "-" : Number(v.toFixed(3))]);
      });
    });
    const vals = rows.flatMap((r) =>
      METRIC_KEYS.map((k) => r[k]).filter((v): v is number => v != null),
    );
    return {
      tooltip: {
        position: "top",
        formatter: (p: { data: [number, number, number] }) =>
          `${models[p.data[1]]}<br/>${metricLabels.label(METRIC_KEYS[p.data[0]])}: ${p.data[2]}`,
      },
      grid: { left: 130, right: 16, top: 20, bottom: 50 },
      xAxis: {
        type: "category",
        data: METRIC_KEYS.map((k) => metricLabels.label(k)),
        splitArea: { show: true },
      },
      yAxis: {
        type: "category",
        data: models,
        splitArea: { show: true },
        axisLabel: { fontSize: 9 },
      },
      visualMap: {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: ["#eff6ff", "#60a5fa", "#1e3a8a"] },
      },
      series: [
        {
          type: "heatmap",
          data: points,
          label: { show: models.length <= 14, fontSize: 9 },
        },
      ],
    };
  }, [rows, metricLabels]);

  if (rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t("common.noData")}
      </p>
    );
  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(240, rows.length * 24 + 80) }}
      notMerge
      lazyUpdate
    />
  );
}

function OcgChart({
  rows,
  baseline,
}: {
  rows: CalibrationRow[];
  baseline: number;
}) {
  const { t } = useTranslation();

  const option = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => (b.ocgIdiom ?? -Infinity) - (a.ocgIdiom ?? -Infinity),
    );
    const labels = sorted.map((r) => r.model);
    const idiomLabel = t("results.ocg.idiom");
    const compositionalLabel = t("results.ocg.compositional");
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0, data: [idiomLabel, compositionalLabel] },
      grid: { left: 48, right: 16, top: 36, bottom: 110 },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { rotate: 45, fontSize: 9 },
      },
      yAxis: { type: "value", name: "OCG" },
      series: [
        {
          name: idiomLabel,
          type: "bar",
          data: sorted.map((r) => ({
            value: r.ocgIdiom == null ? null : Number(r.ocgIdiom.toFixed(3)),
            itemStyle: { color: r.unstable ? "#9ca3af" : "#dc2626" },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                yAxis: baseline,
                label: {
                  formatter: t("results.charts.baseline", { value: baseline }),
                },
                lineStyle: { color: "#16a34a" },
              },
            ],
          },
        },
        {
          name: compositionalLabel,
          type: "bar",
          data: sorted.map((r) =>
            r.ocgCompositional == null
              ? null
              : Number(r.ocgCompositional.toFixed(3)),
          ),
          itemStyle: { color: "#2563eb" },
        },
      ],
    };
  }, [rows, baseline, t]);

  if (rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t("results.ocg.noData")}
      </p>
    );
  return (
    <ReactECharts option={option} style={{ height: 380 }} notMerge lazyUpdate />
  );
}

function CalibrationTable({ rows }: { rows: CalibrationRow[] }) {
  const { t } = useTranslation();
  const sorted = [...rows].sort(
    (a, b) => (b.ocgIdiom ?? -Infinity) - (a.ocgIdiom ?? -Infinity),
  );
  return (
    <div className="max-h-[50vh] overflow-auto rounded-md border border-[hsl(var(--border))]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[hsl(var(--card))] shadow-sm">
          <tr className="border-b border-[hsl(var(--border))] text-left">
            <th className="px-3 py-2 font-medium">
              {t("results.calibrationTable.model")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("results.calibrationTable.idiomGap")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("results.calibrationTable.compGap")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("results.calibrationTable.ordinaryGap")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("results.calibrationTable.ocgIdiom")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("results.calibrationTable.ocgComp")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.model}
              className="border-b border-[hsl(var(--border))] last:border-0"
            >
              <td className="px-3 py-2 font-medium">
                <span className="flex items-center gap-1">
                  {r.model}
                  {r.unstable ? (
                    <span
                      title={
                        r.warning ?? t("results.calibrationTable.unstable")
                      }
                    >
                      <AlertTriangle className="h-3 w-3 text-[hsl(var(--warning))]" />
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(r.idiomGap)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(r.compositionalGap)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(r.ordinaryGap)}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {fmt(r.ocgIdiom, 2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(r.ocgCompositional, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScatterChart({
  rows,
  xAxis,
  yAxis,
}: {
  rows: IndicatorRow[];
  xAxis: MetricKey;
  yAxis: MetricKey;
}) {
  const metricLabels = useMetricLabels();

  const option = useMemo(() => {
    const byFamily: Record<string, [number, number, string][]> = {};
    for (const r of rows) {
      const x = r[xAxis];
      const y = r[yAxis];
      if (x == null || y == null) continue;
      (byFamily[r.modelType] ??= []).push([
        x,
        y,
        `${r.model} · ${r.lang}/${r.context}`,
      ]);
    }
    const xLabel = metricLabels.label(xAxis);
    const yLabel = metricLabels.label(yAxis);
    return {
      tooltip: {
        formatter: (p: { data: [number, number, string] }) =>
          `${p.data[2]}<br/>${xLabel}: ${p.data[0].toFixed(3)}<br/>${yLabel}: ${p.data[1].toFixed(3)}`,
      },
      legend: { top: 0 },
      grid: { left: 48, right: 16, top: 36, bottom: 48 },
      xAxis: { type: "value", name: xLabel, scale: true },
      yAxis: { type: "value", name: yLabel, scale: true },
      series: Object.entries(byFamily).map(([fam, pts]) => ({
        name: fam,
        type: "scatter",
        symbolSize: 9,
        itemStyle: { color: familyColor(fam) },
        data: pts,
      })),
    };
  }, [rows, xAxis, yAxis, metricLabels]);

  return (
    <ReactECharts option={option} style={{ height: 360 }} notMerge lazyUpdate />
  );
}

function IndicatorsTable({
  rows,
  sorting,
  setSorting,
}: {
  rows: IndicatorRow[];
  sorting: SortingState;
  setSorting: (s: SortingState) => void;
}) {
  const { t } = useTranslation();
  const metricLabels = useMetricLabels();
  const formatNumber = useFormatNumber();
  const scoped = rows;

  const columns = useMemo<ColumnDef<IndicatorRow>[]>(() => {
    const base: ColumnDef<IndicatorRow>[] = [
      {
        accessorKey: "model",
        header: t("results.indicatorsTable.columns.model"),
      },
      {
        accessorKey: "studyExperiment",
        header: t("results.indicatorsTable.columns.experiment"),
        cell: ({ getValue }) => (
          <Badge variant="outline">{getValue<number>()}</Badge>
        ),
      },
      {
        accessorKey: "modelType",
        header: t("results.indicatorsTable.columns.family"),
      },
      {
        accessorKey: "lang",
        header: t("results.indicatorsTable.columns.language"),
      },
      {
        accessorKey: "context",
        header: t("results.indicatorsTable.columns.context"),
      },
      {
        accessorKey: "representationLevel",
        header: t("results.indicatorsTable.columns.representation"),
        cell: ({ getValue }) => (
          <span className="text-xs">
            {getValue<string>().replace("_", " ")}
          </span>
        ),
      },
    ];
    const metricCols: ColumnDef<IndicatorRow>[] = METRIC_KEYS.map((mk) => ({
      accessorKey: mk,
      header: metricLabels.label(mk),
      cell: ({ getValue }) => (
        <span className="tabular-nums">{fmt(getValue<number | null>())}</span>
      ),
    }));
    return [...base, ...metricCols];
  }, [t, metricLabels]);

  const table = useReactTable({
    data: scoped,
    columns,
    state: { sorting },
    onSortingChange: (updater) =>
      setSorting(typeof updater === "function" ? updater(sorting) : updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{t("results.indicatorsTable.title")}</CardTitle>
        <CardDescription>
          {t("results.indicatorsTable.description", {
            count: formatNumber(scoped.length),
          })}
        </CardDescription>
      </CardHeader>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[hsl(var(--card))] shadow-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[hsl(var(--border))]">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium"
                  >
                    <button
                      className="inline-flex items-center gap-1 hover:opacity-70"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[hsl(var(--border))] last:border-0"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
