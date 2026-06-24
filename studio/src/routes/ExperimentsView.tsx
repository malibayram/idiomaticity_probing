import { useAuth } from "@/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useResearchSnapshot } from "@/data/hooks";
import {
    loadJobTemplate,
    queueJob,
    requestJobCancellation,
    type JobTemplateName,
} from "@/data/repository";
import type { JobRecord } from "@/data/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function jobStatusVariant(
  status: JobRecord["status"],
): "success" | "warning" | "destructive" | "primary" | "default" {
  switch (status) {
    case "succeeded":
      return "success";
    case "running":
      return "primary";
    case "queued":
      return "warning";
    case "failed":
      return "destructive";
    default:
      return "default";
  }
}

export function ExperimentsView() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useResearchSnapshot();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const runSummary = useMemo(() => {
    const runs = data?.snapshot.runs ?? [];
    const byLang: Record<string, number> = {};
    for (const r of runs) byLang[r.language] = (byLang[r.language] ?? 0) + 1;
    return { total: runs.length, byLang };
  }, [data]);

  if (isLoading) return <FullPageSpinner label={t("experiments.loading")} />;
  if (isError)
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("common.dataLoadFailed", {
          message:
            error instanceof Error ? error.message : t("common.unknownError"),
        })}
      </p>
    );

  const jobs = data?.snapshot.jobs ?? [];
  const privileged = profile?.role === "curator" || profile?.role === "admin";

  async function enqueue(name: JobTemplateName) {
    if (!profile || data?.origin !== "firestore") return;
    setBusy(name);
    setActionMessage(null);
    try {
      const template = await loadJobTemplate(name);
      await queueJob(
        {
          ...template,
          id: `${name}-${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
        profile.uid,
      );
      setActionMessage(
        t("experiments.newJob.queued", { title: template.title }),
      );
      await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] });
    } catch (reason) {
      setActionMessage(
        reason instanceof Error
          ? t("experiments.newJob.errorPrefix", { message: reason.message })
          : t("experiments.newJob.queueFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("experiments.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("experiments.subtitle")}
        </p>
      </div>

      {privileged ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("experiments.newJob.title")}</CardTitle>
            <CardDescription>
              {t("experiments.newJob.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.origin !== "firestore" ? (
              <p className="text-xs text-[hsl(var(--warning))]">
                {t("experiments.newJob.enableFirestore")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["validate-tr", "experiments.newJob.validate"],
                  ["aggregate-tr", "experiments.newJob.aggregate"],
                  ["export-tr-draft", "experiments.newJob.exportDraft"],
                  ["experiment-tr-mock", "experiments.newJob.smokeRun"],
                  ["analyze-tr-mock", "experiments.newJob.smokeAnalysis"],
                ] as [JobTemplateName, string][]
              ).map(([name, labelKey]) => (
                <Button
                  key={name}
                  variant="outline"
                  disabled={data?.origin !== "firestore" || busy === name}
                  onClick={() => void enqueue(name)}
                >
                  {busy === name
                    ? t("experiments.newJob.queueing")
                    : t(labelKey)}
                </Button>
              ))}
            </div>
            {actionMessage ? <p className="text-sm">{actionMessage}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("experiments.stats.jobs")}
            </p>
            <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("experiments.stats.runs")}
            </p>
            <p className="mt-1 text-2xl font-semibold">{runSummary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t("experiments.stats.runsPerLanguage")}
            </p>
            <p className="mt-1 text-sm">
              {Object.entries(runSummary.byLang)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ") || "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("experiments.queue.title")}</CardTitle>
          <CardDescription>
            {t("experiments.queue.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("experiments.queue.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {job.type} · {job.createdAt.slice(0, 10)}
                    </p>
                    {job.error ? (
                      <p className="text-xs text-[hsl(var(--destructive))]">
                        {job.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                      {job.progress}%
                    </span>
                    <Badge variant={jobStatusVariant(job.status)}>
                      {job.status}
                    </Badge>
                    {privileged &&
                    (job.status === "queued" || job.status === "running") ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setBusy(job.id);
                          try {
                            await requestJobCancellation(job.id);
                            await queryClient.invalidateQueries({
                              queryKey: ["research-snapshot"],
                            });
                          } finally {
                            setBusy(null);
                          }
                        }}
                        disabled={busy === job.id}
                      >
                        {t("experiments.queue.cancel")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
