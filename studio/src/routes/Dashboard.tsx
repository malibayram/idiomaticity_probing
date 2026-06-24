import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useReferenceDatasetIndex, useResearchSnapshot } from "@/data/hooks";
import { useDomainLabels, useFormatNumber } from "@/i18n/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { WORKFLOW_ORDER } from "@/lib/domain-labels";

const LANGUAGES = [
  { code: "EN", labelKey: "dashboard.english", noteKey: "dashboard.readOnlyReference" },
  { code: "PT", labelKey: "dashboard.portuguese", noteKey: "dashboard.readOnlyReference" },
] as const;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {sub ? <p className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-[hsl(var(--muted))]">
      <div
        className="h-full rounded bg-[hsl(var(--primary))]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { compClassLabel, workflowLabel, COMP_CLASS_VARIANT } = useDomainLabels();
  const { profile } = useAuth();
  const { data, isLoading } = useResearchSnapshot();
  const referenceQuery = useReferenceDatasetIndex();

  const stats = useMemo(() => {
    if (!data) return null;
    const { snapshot } = data;
    const mwes = snapshot.mwes;
    const classCounts: Record<string, number> = { I: 0, PC: 0, C: 0 };
    const statusCounts: Record<string, number> = {};
    let goldRated = 0;
    let contexts = 0;
    for (const m of mwes) {
      const cls = m.goldClass ?? m.provisionalClass;
      classCounts[cls] = (classCounts[cls] ?? 0) + 1;
      statusCounts[m.workflowStatus] = (statusCounts[m.workflowStatus] ?? 0) + 1;
      if (m.goldScore != null) goldRated += 1;
      contexts += m.contexts.length;
    }
    return {
      project: snapshot.project,
      total: mwes.length,
      classCounts,
      statusCounts,
      goldRated,
      contexts,
      sources: snapshot.sources.length,
      campaigns: snapshot.campaigns.length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {profile?.displayName
              ? t("dashboard.welcomeWithName", { name: profile.displayName })
              : t("dashboard.welcome")}
          </p>
        </div>
        {data ? (
          <Badge variant={data.origin === "firestore" ? "success" : "warning"}>
            {data.origin === "firestore" ? t("common.firestore") : t("common.localSeed")}
          </Badge>
        ) : null}
      </div>

      {isLoading || !stats ? (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Spinner className="h-4 w-4" /> {t("dashboard.loading")}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("dashboard.totalMwe")}
              value={`${stats.total}`}
              sub={t("dashboard.targetCount", { count: stats.project.targetMweCount })}
            />
            <StatCard
              label={t("dashboard.goldRated")}
              value={`${stats.goldRated}`}
              sub={t("dashboard.waitingCount", { count: stats.total - stats.goldRated })}
            />
            <StatCard label={t("dashboard.sources")} value={`${stats.sources}`} />
            <StatCard label={t("dashboard.campaigns")} value={`${stats.campaigns}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.classDistribution")}</CardTitle>
                <CardDescription>{t("dashboard.classDistributionDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(["I", "PC", "C"] as const).map((cls) => (
                  <div key={cls} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant={COMP_CLASS_VARIANT[cls]}>{cls}</Badge>
                        {compClassLabel(cls)}
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {stats.classCounts[cls] ?? 0}
                      </span>
                    </div>
                    <Bar value={stats.classCounts[cls] ?? 0} total={stats.total} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.workflowStatus")}</CardTitle>
                <CardDescription>
                  {t("dashboard.workflowStatusDesc", {
                    contexts: formatNumber(stats.contexts),
                    sentences: formatNumber(stats.project.targetSentenceCount),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {WORKFLOW_ORDER.filter((s) => stats.statusCounts[s]).map((status) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span>{workflowLabel(status)}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {stats.statusCounts[status]}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link to="/studio/mwes" className="block">
              <Card className="h-full transition-colors hover:border-[hsl(var(--primary))]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {t("dashboard.turkish")}
                    <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">TR</span>
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.activeCuration")} · {stats.project.protocolVersion}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {t("dashboard.expressionsOpen", {
                      current: stats.total,
                      target: stats.project.targetMweCount,
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
            {LANGUAGES.map((lang) => (
              <Link key={lang.code} to={`/mwes?lang=${lang.code}`} className="block">
                <Card className="h-full transition-colors hover:border-[hsl(var(--primary))]">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {t(lang.labelKey)}
                      <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
                        {lang.code}
                      </span>
                    </CardTitle>
                    <CardDescription>{t(lang.noteKey)}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {referenceQuery.data ? (
                      <p>
                        {t("dashboard.rawRecords", {
                          count: referenceQuery.data.summary[lang.code].rawSnapshotMweCount,
                        })}{" "}
                        ·{" "}
                        {t("dashboard.humanScored", {
                          count: referenceQuery.data.summary[lang.code].scoredMweCount,
                        })}{" "}
                        · {t("dashboard.openToReview")}
                      </p>
                    ) : (
                      <p>{t("dashboard.referenceSummaryLoading")}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
