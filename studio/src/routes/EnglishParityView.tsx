import { Badge } from "@/components/ui/badge";
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
  computeParitySummary,
  PARITY_DIMENSIONS,
  type ParityDimension,
} from "@/data/english-parity";
import { useResearchSnapshot } from "@/data/hooks";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type FilterMode = "all" | "incomplete" | "complete";
type SortMode = "closenessAsc" | "closenessDesc" | "alpha";

export function EnglishParityView() {
  const { t } = useTranslation();
  const { data, isLoading } = useResearchSnapshot();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("incomplete");
  const [sort, setSort] = useState<SortMode>("closenessAsc");

  const summary = useMemo(
    () => computeParitySummary(data?.snapshot.mwes ?? []),
    [data?.snapshot.mwes],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    let items = summary.items.filter((item) => {
      if (filter === "incomplete" && item.missing.length === 0) return false;
      if (filter === "complete" && item.missing.length > 0) return false;
      if (term && !item.canonicalForm.toLocaleLowerCase("tr").includes(term))
        return false;
      return true;
    });
    items = [...items].sort((a, b) => {
      if (sort === "alpha")
        return a.canonicalForm.localeCompare(b.canonicalForm, "tr");
      if (sort === "closenessDesc")
        return b.pct - a.pct || a.canonicalForm.localeCompare(b.canonicalForm, "tr");
      return a.pct - b.pct || a.canonicalForm.localeCompare(b.canonicalForm, "tr");
    });
    return items;
  }, [summary.items, search, filter, sort]);

  if (isLoading) return <FullPageSpinner label={t("parity.loading")} />;
  if (!data) return <p className="text-sm">{t("parity.loadFailed")}</p>;

  const dimensionLabel = (dimension: ParityDimension) =>
    t(`parity.dimensions.${dimension}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("parity.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("parity.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("parity.summary.avgTitle")}</CardTitle>
            <CardDescription>
              {t("parity.summary.referenceNote", {
                items: summary.itemCount,
                reference: summary.referenceCount,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums">
              {summary.avgPct}%
            </p>
            <ProgressBar pct={summary.avgPct} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("parity.summary.completeTitle")}</CardTitle>
            <CardDescription>
              {t("parity.summary.completeNote")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums">
              {summary.completeCount}
              <span className="text-lg text-[hsl(var(--muted-foreground))]">
                {" "}
                / {summary.itemCount}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-1">
          <CardHeader>
            <CardTitle>{t("parity.summary.coverageTitle")}</CardTitle>
            <CardDescription>{t("parity.summary.coverageNote")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {PARITY_DIMENSIONS.map((dimension) => {
              const count = summary.dimensionCoverage[dimension];
              const pct = summary.itemCount
                ? Math.round((count / summary.itemCount) * 100)
                : 0;
              return (
                <div key={dimension} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">
                      {dimensionLabel(dimension)}
                    </span>
                    <span className="tabular-nums text-[hsl(var(--muted-foreground))]">
                      {count}/{summary.itemCount} · {pct}%
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("parity.legend.title")}</CardTitle>
          <CardDescription>{t("parity.legend.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {PARITY_DIMENSIONS.map((dimension) => (
              <li key={dimension} className="flex gap-2">
                <Badge variant="outline">{dimensionLabel(dimension)}</Badge>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {t(`parity.dimensionHelp.${dimension}`)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("parity.table.title")}</CardTitle>
          <CardDescription>
            {t("parity.table.description", { count: rows.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("parity.table.searchPlaceholder")}
              className="min-w-[200px] flex-1"
            />
            <Select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterMode)}
            >
              <option value="incomplete">{t("parity.filter.incomplete")}</option>
              <option value="all">{t("parity.filter.all")}</option>
              <option value="complete">{t("parity.filter.complete")}</option>
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
            >
              <option value="closenessAsc">{t("parity.sort.closenessAsc")}</option>
              <option value="closenessDesc">
                {t("parity.sort.closenessDesc")}
              </option>
              <option value="alpha">{t("parity.sort.alpha")}</option>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
                  <th className="py-2 pr-3 font-medium">
                    {t("parity.table.mwe")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {t("parity.table.closeness")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {t("parity.table.dimensions")}
                  </th>
                  <th className="py-2 font-medium">{t("parity.table.todo")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-[hsl(var(--muted-foreground))]"
                    >
                      {t("parity.table.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[hsl(var(--border))] align-top"
                    >
                      <td className="py-2 pr-3">
                        <span className="block font-medium">
                          {item.canonicalForm}
                        </span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {item.id}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="w-9 tabular-nums">{item.pct}%</span>
                          <div className="w-24">
                            <ProgressBar pct={item.pct} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {PARITY_DIMENSIONS.map((dimension) => {
                            const present =
                              dimension === "gold"
                                ? item.gold
                                : item.families[dimension];
                            return (
                              <Badge
                                key={dimension}
                                variant={present ? "success" : "outline"}
                                className={
                                  present
                                    ? undefined
                                    : "text-[hsl(var(--muted-foreground))]"
                                }
                              >
                                {present ? "✓ " : ""}
                                {dimensionLabel(dimension)}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2">
                        {item.missing.length === 0 ? (
                          <span className="text-[hsl(var(--muted-foreground))]">
                            {t("parity.table.todoNone")}
                          </span>
                        ) : (
                          <span>
                            {t("parity.table.todoPrefix")}{" "}
                            {item.missing
                              .map((dimension) => dimensionLabel(dimension))
                              .join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded bg-[hsl(var(--muted))]">
      <div
        className="h-full bg-[hsl(var(--primary))]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
