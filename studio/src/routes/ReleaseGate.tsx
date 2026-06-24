import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Download, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResearchSnapshot, useValidationReport } from "@/data/hooks";
import { loadJobTemplate, queueJob } from "@/data/repository";
import { useFormatNumber } from "@/i18n/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/ui/spinner";

export function ReleaseGate() {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const reportQuery = useValidationReport();
  const snapshotQuery = useResearchSnapshot();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (reportQuery.isLoading || snapshotQuery.isLoading) {
    return <FullPageSpinner label={t("release.loading")} />;
  }
  if (reportQuery.isError || !reportQuery.data) {
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("release.loadFailed", {
          message:
            reportQuery.error instanceof Error
              ? reportQuery.error.message
              : t("common.unknownError"),
        })}
      </p>
    );
  }
  const report = reportQuery.data;
  const privileged = profile?.role === "curator" || profile?.role === "admin";

  async function queueValidation() {
    if (!profile || snapshotQuery.data?.origin !== "firestore") return;
    setBusy(true);
    setMessage(null);
    try {
      const template = await loadJobTemplate("validate-tr");
      await queueJob(
        { ...template, id: `validate-tr-${Date.now()}`, createdAt: new Date().toISOString() },
        profile.uid,
      );
      setMessage(t("release.queueSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] });
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? t("release.errorPrefix", { message: reason.message })
          : t("release.queueFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("release.title")}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("release.subtitle")}</p>
        </div>
        {privileged ? (
          <Button
            variant="outline"
            onClick={() => void queueValidation()}
            disabled={busy || snapshotQuery.data?.origin !== "firestore"}
          >
            <RefreshCw className="h-4 w-4" />
            {busy ? t("release.queueing") : t("release.validateLive")}
          </Button>
        ) : null}
      </div>
      {message ? <p className="rounded-md border p-3 text-sm">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {report.releaseReady ? (
              <CheckCircle2 className="text-[hsl(var(--success))]" />
            ) : (
              <AlertCircle className="text-[hsl(var(--warning))]" />
            )}
            {report.releaseReady ? t("release.ready") : t("release.notReady")}
          </CardTitle>
          <CardDescription>
            {t("release.summary", {
              errors: formatNumber(report.metrics.errorCount),
              warnings: formatNumber(report.metrics.warningCount),
              sentences: formatNumber(report.metrics.sentenceCount),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={t("release.metrics.mwe")} value={report.metrics.mweCount} />
          <Metric label={t("release.metrics.context")} value={report.metrics.contextCount} />
          <Metric label={t("release.metrics.externalExample")} value={report.metrics.externalContextCount} />
          <Metric
            label={t("release.metrics.ordinaryControl")}
            value={report.metrics.ordinaryControlApprovedCount ?? 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("release.gates.title")}</CardTitle>
          <CardDescription>{t("release.gates.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(report.gateCounts).map(([code, count]) => (
            <div
              key={code}
              className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {count === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[hsl(var(--destructive))]" />
                )}
                <div>
                  <p className="text-sm font-medium">{t(`release.gates.labels.${code}`)}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{code}</p>
                </div>
              </div>
              <Badge variant={count === 0 ? "success" : "warning"}>
                {count === 0 ? t("release.gates.passed") : t("release.gates.missing", { count })}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("release.issues.title")}</CardTitle>
          <CardDescription>{t("release.issues.description")}</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[420px] space-y-2 overflow-auto">
          {report.issues.slice(0, 100).map((issue, index) => (
            <div
              key={`${issue.code}-${issue.mwe_id}-${issue.context_id}-${index}`}
              className="rounded border border-[hsl(var(--border))] p-2 text-xs"
            >
              <div className="flex gap-2">
                <Badge variant={issue.severity === "error" ? "destructive" : "warning"}>
                  {issue.code}
                </Badge>
                <span>
                  {issue.mwe_id}
                  {issue.context_id ? ` · ${issue.context_id}` : ""}
                </span>
              </div>
              <p className="mt-1">{issue.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("release.artifacts.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(
            [
              ["/reports/tr_validation.json", "release.artifacts.validationJson"],
              ["/reports/tr_validation.md", "release.artifacts.validationMarkdown"],
            ] as const
          ).map(([href, labelKey]) => (
            <a key={href} href={href} download>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                {t(labelKey)}
              </Button>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const formatNumber = useFormatNumber();
  return (
    <div className="rounded-md bg-[hsl(var(--muted))]/50 p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}
