import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { useResearchSnapshot } from "@/data/hooks";
import { saveSource } from "@/data/repository";
import type { SourceRecord } from "@/data/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/ui/spinner";

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "default"> = {
  P0: "destructive",
  P1: "warning",
  P2: "default",
};

function prettyCategory(c: string) {
  return c.replace(/_/g, " ");
}

/** A license that needs review is surfaced as a warning, not a blocker. */
function needsLicenseReview(license: string) {
  const l = license.toLowerCase();
  return l.includes("unknown") || l.includes("belirsiz") || l.includes("review") || l === "";
}

export function SourcesLibrary() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useResearchSnapshot();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  const sources = useMemo(() => data?.snapshot.sources ?? [], [data]);
  const categories = useMemo(
    () => [...new Set(sources.map((s) => s.category))].sort(),
    [sources],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (priority !== "all" && s.priority !== priority) return false;
      if (q && !`${s.title} ${s.notes} ${s.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sources, search, category, priority]);

  if (isLoading) return <FullPageSpinner label={t("sources.loading")} />;
  if (isError)
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("common.dataLoadFailed", {
          message: error instanceof Error ? error.message : t("common.unknownError"),
        })}
      </p>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("sources.title")}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("sources.subtitle", { count: sources.length })}
        </p>
      </div>

      {profile && (profile.role === "curator" || profile.role === "admin") ? (
        <div className="flex justify-end"><Button variant="outline" disabled={data?.origin !== "firestore"} onClick={() => setEditingId(editingId === "__new__" ? null : "__new__")}>{editingId === "__new__" ? t("sources.closeNew") : t("sources.addNew")}</Button></div>
      ) : null}
      {editingId === "__new__" && profile ? (
        <Card className="p-4"><SourceEditor source={{ id: `SRC-${String(sources.length + 1).padStart(3, "0")}`, title: "", category: "candidate_source", status: "review_required", priority: "P1", url: "", paperUrl: null, license: "review_required", observedSize: "unknown", useForNcimp: "candidate review", notes: "", lastChecked: new Date().toISOString().slice(0, 10) }} onSave={async (next) => { await saveSource(next, profile.uid); await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] }); setEditingId(null); }} /></Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={t("sources.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">{t("sources.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {prettyCategory(c)}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="all">{t("sources.allPriorities")}</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
        </Select>
        {(search || category !== "all" || priority !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setCategory("all");
              setPriority("all");
            }}
          >
            <X className="h-4 w-4" /> {t("common.clear")}
          </Button>
        )}
        <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))]">
          {filtered.length} {t("common.results")}
        </span>
      </div>

      <div className="grid gap-3">
        {filtered.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={PRIORITY_VARIANT[s.priority] ?? "default"}>{s.priority}</Badge>
                  <span className="font-medium">{s.title}</span>
                  <Badge variant="outline">{prettyCategory(s.category)}</Badge>
                </div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{s.notes}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    <span className="text-[hsl(var(--muted-foreground))]">{t("common.license")}: </span>
                    {needsLicenseReview(s.license) ? (
                      <Badge variant="warning">{t("sources.licenseReview", { license: s.license || t("sources.licenseUnknown") })}</Badge>
                    ) : (
                      s.license
                    )}
                  </span>
                  <span>
                    <span className="text-[hsl(var(--muted-foreground))]">{t("common.status")}: </span>
                    {s.status.replace(/_/g, " ")}
                  </span>
                  <span>
                    <span className="text-[hsl(var(--muted-foreground))]">{t("common.size")}: </span>
                    {s.observedSize}
                  </span>
                  <span>
                    <span className="text-[hsl(var(--muted-foreground))]">{t("sources.ncimpUse")}: </span>
                    {s.useForNcimp}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
                  >
                    {t("common.source")} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                {s.paperUrl ? (
                  <a
                    href={s.paperUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
                  >
                    {t("common.paper")} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                <span className="text-[hsl(var(--muted-foreground))]">{s.lastChecked}</span>
                {profile && (profile.role === "curator" || profile.role === "admin") ? <Button size="sm" variant="outline" disabled={data?.origin !== "firestore"} onClick={() => setEditingId(editingId === s.id ? null : s.id)}>{editingId === s.id ? t("common.close") : t("common.edit")}</Button> : null}
              </div>
            </div>
            {editingId === s.id && profile ? <SourceEditor source={s} onSave={async (next) => { await saveSource(next, profile.uid); await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] }); setEditingId(null); }} /> : null}
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {t("sources.noMatches")}
          </p>
        )}
      </div>
    </div>
  );
}

function SourceEditor({ source, onSave }: { source: SourceRecord; onSave: (source: SourceRecord) => Promise<void> }) {
  const { t } = useTranslation();
  const isNew = !source.title;
  const [draft, setDraft] = useState(source);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="mt-4 grid gap-2 border-t border-[hsl(var(--border))] pt-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs"><span>{t("sources.editor.sourceId")}</span><Input disabled={!isNew} value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></label>
      <label className="space-y-1 text-xs"><span>{t("sources.editor.title")}</span><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="space-y-1 text-xs sm:col-span-2"><span>{t("sources.editor.url")}</span><Input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label>
      <label className="space-y-1 text-xs"><span>{t("sources.editor.status")}</span><Input value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} /></label>
      <label className="space-y-1 text-xs"><span>{t("sources.editor.priority")}</span><Select className="w-full" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as "P0" | "P1" | "P2" })}><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option></Select></label>
      <label className="space-y-1 text-xs sm:col-span-2"><span>{t("sources.editor.licenseTerms")}</span><Input value={draft.license} onChange={(event) => setDraft({ ...draft, license: event.target.value })} /></label>
      <label className="space-y-1 text-xs sm:col-span-2"><span>{t("sources.editor.ncimpUse")}</span><Input value={draft.useForNcimp} onChange={(event) => setDraft({ ...draft, useForNcimp: event.target.value })} /></label>
      <label className="space-y-1 text-xs sm:col-span-2"><span>{t("sources.editor.notes")}</span><textarea className="w-full rounded-md border bg-transparent p-2" rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      <div className="flex items-center gap-2 sm:col-span-2"><Button disabled={saving || !draft.title.trim()} onClick={async () => { setSaving(true); setMessage(null); try { await onSave({ ...draft, lastChecked: new Date().toISOString().slice(0, 10) }); setMessage(t("common.saved")); } catch (reason) { setMessage(reason instanceof Error ? reason.message : t("common.saveFailed")); } finally { setSaving(false); } }}>{saving ? t("common.saving") : t("sources.editor.saveSource")}</Button>{message ? <span className="text-xs">{message}</span> : null}</div>
    </div>
  );
}
