import { SpanText } from "@/components/SpanText";
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
import { useReferenceDataset } from "@/data/hooks";
import type { ReferenceMweRecord } from "@/data/schema";
import { useDomainLabels } from "@/i18n/hooks";
import { LockKeyhole, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export function ReferenceInventory({ language }: { language: "EN" | "PT" }) {
  const { t } = useTranslation();
  const { COMP_CLASS_VARIANT } = useDomainLabels();
  const query = useReferenceDataset(language, true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (classFilter !== "all" && item.goldClass !== classFilter) return false;
      return (
        !needle ||
        `${item.id} ${item.canonicalForm} ${item.modifier} ${item.head}`
          .toLocaleLowerCase()
          .includes(needle)
      );
    });
  }, [items, search, classFilter]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  if (query.isLoading)
    return <FullPageSpinner label={t("reference.loading", { language })} />;
  if (query.isError || !query.data) {
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("reference.loadFailed", {
          message:
            query.error instanceof Error
              ? query.error.message
              : t("common.unknownError"),
        })}
      </p>
    );
  }
  const { summary } = query.data;

  return (
    <div className="space-y-4">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
          <Badge variant="primary">
            {t("reference.readOnlyBadge", { language })}
          </Badge>
          <span>
            {t("reference.paperCount")}{" "}
            <strong>{summary.officialPaperMweCount}</strong>
          </span>
          <span>
            {t("reference.rawSnapshot")}{" "}
            <strong>{summary.rawSnapshotMweCount}</strong>
          </span>
          <span>
            {t("reference.humanScored")}{" "}
            <strong>{summary.scoredMweCount}</strong>
          </span>
          <span>
            {t("reference.fiveContexts")}{" "}
            <strong>{summary.contextCount}</strong>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <LockKeyhole className="h-3.5 w-3.5" />{" "}
            {t("reference.firestorePublication")}
          </span>
        </CardContent>
      </Card>

      {language === "EN" ? (
        <div className="rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-3 text-xs">
          {t("reference.enAuditNote")}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("reference.searchPlaceholder")}
          />
        </div>
        <Select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
        >
          <option value="all">{t("reference.allClasses")}</option>
          <option value="I">{t("reference.classOptions.I")}</option>
          <option value="PC">{t("reference.classOptions.PC")}</option>
          <option value="C">{t("reference.classOptions.C")}</option>
        </Select>
        <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))]">
          {filtered.length} {t("common.results")}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <Card className="overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]">
                <tr className="border-b">
                  <th className="p-3 text-left">
                    {t("reference.columns.expression")}
                  </th>
                  <th className="p-3 text-left">
                    {t("reference.columns.class")}
                  </th>
                  <th className="p-3 text-left">
                    {t("reference.columns.humanScore")}
                  </th>
                  <th className="p-3 text-left">
                    {t("reference.columns.context")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`cursor-pointer border-b hover:bg-[hsl(var(--accent))] ${selectedId === item.id ? "bg-[hsl(var(--accent))]" : ""}`}
                  >
                    <td className="p-3">
                      <p className="font-medium">{item.canonicalForm}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {item.modifier} → {item.head}
                      </p>
                    </td>
                    <td className="p-3">
                      {item.goldClass ? (
                        <Badge variant={COMP_CLASS_VARIANT[item.goldClass]}>
                          {item.goldClass}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          {t("reference.unscored")}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {item.goldScore?.toFixed(2) ?? "-"}
                    </td>
                    <td className="p-3">{item.contexts.length}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <ReferenceDetail item={selected} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("reference.detail.title")}</CardTitle>
                <CardDescription>{t("reference.detail.hint")}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferenceDetail({ item }: { item: ReferenceMweRecord }) {
  const { t } = useTranslation();
  const { compClassLabel, COMP_CLASS_VARIANT } = useDomainLabels();
  return (
    <Card className="max-h-[78vh] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {item.canonicalForm}
          {item.goldClass ? (
            <Badge variant={COMP_CLASS_VARIANT[item.goldClass]}>
              {item.goldClass}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {item.id} ·{" "}
          {item.goldClass
            ? compClassLabel(item.goldClass)
            : t("reference.detail.noHumanScore")}{" "}
          ·{" "}
          {t("reference.detail.score", {
            value: item.goldScore?.toFixed(2) ?? "-",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {item.contexts.map((context) => (
          <div
            key={context.id}
            className="space-y-3 rounded-md border border-[hsl(var(--border))] p-3"
          >
            <div className="flex items-center justify-between">
              <Badge
                variant={
                  context.family === "naturalistic" ? "success" : "outline"
                }
              >
                {context.slot}
              </Badge>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {context.sourceFile}
              </span>
            </div>
            <p className="text-sm">
              <SpanText
                sentence={context.original.sentence}
                surface={context.original.targetSurface}
                span={context.original.span}
              />
            </p>
            <div className="space-y-2">
              {Object.entries(context.probes).map(([kind, variants]) => (
                <details
                  key={kind}
                  className="rounded bg-[hsl(var(--muted))]/50 p-2"
                >
                  <summary className="cursor-pointer text-xs font-medium">
                    {kind} · {t(`reference.probes.${kind}`)} ({variants.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {variants.map((variant, index) => (
                      <p
                        key={`${kind}-${index}`}
                        className="border-l-2 border-[hsl(var(--primary))]/30 pl-2 text-xs"
                      >
                        <SpanText
                          sentence={variant.sentence}
                          surface={variant.targetSurface}
                          span={variant.span}
                        />
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
