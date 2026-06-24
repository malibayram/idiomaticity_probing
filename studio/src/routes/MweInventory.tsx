import { useAuth } from "@/auth/AuthProvider";
import { SpanText } from "@/components/SpanText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useResearchSnapshot } from "@/data/hooks";
import { saveMwe } from "@/data/repository";
import type { MweRecord } from "@/data/schema";
import { useDomainLabels } from "@/i18n/hooks";
import { COMP_CLASS_VARIANT, WORKFLOW_ORDER } from "@/lib/domain-labels";
import { ReferenceInventory } from "@/routes/ReferenceInventory";
import { useQueryClient } from "@tanstack/react-query";
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

function ClassBadge({ value }: { value: string | null | undefined }) {
  if (!value)
    return <span className="text-[hsl(var(--muted-foreground))]">-</span>;
  return (
    <Badge variant={COMP_CLASS_VARIANT[value] ?? "default"}>{value}</Badge>
  );
}

export function MweInventory() {
  const { t } = useTranslation();
  const { compClassLabel, workflowLabel } = useDomainLabels();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLanguage = searchParams.get("lang");
  const language: "TR" | "EN" | "PT" =
    requestedLanguage === "EN" || requestedLanguage === "PT"
      ? requestedLanguage
      : "TR";
  const { data, isLoading, isError, error } = useResearchSnapshot();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selected, setSelected] = useState<MweRecord | null>(null);

  const mwes = useMemo(() => data?.snapshot.mwes ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mwes.filter((m) => {
      if (
        classFilter !== "all" &&
        (m.goldClass ?? m.provisionalClass) !== classFilter
      )
        return false;
      if (statusFilter !== "all" && m.workflowStatus !== statusFilter)
        return false;
      if (
        q &&
        !`${m.canonicalForm} ${m.meaning} ${m.id}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [mwes, search, classFilter, statusFilter]);

  const columns = useMemo<ColumnDef<MweRecord>[]>(
    () => [
      {
        accessorKey: "canonicalForm",
        header: t("mwes.columns.expression"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.canonicalForm}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {row.original.modifier} → {row.original.head}
            </div>
          </div>
        ),
      },
      {
        id: "class",
        header: t("mwes.columns.class"),
        accessorFn: (m) => m.goldClass ?? m.provisionalClass,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <ClassBadge value={row.original.provisionalClass} />
            {row.original.goldClass ? (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {t("mwes.goldPrefix")} {row.original.goldClass}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "goldScore",
        header: t("mwes.columns.goldScore"),
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return v == null ? (
            <span className="text-[hsl(var(--muted-foreground))]">-</span>
          ) : (
            v.toFixed(2)
          );
        },
      },
      {
        accessorKey: "workflowStatus",
        header: t("mwes.columns.status"),
        cell: ({ getValue }) => (
          <Badge variant="outline">{workflowLabel(getValue<string>())}</Badge>
        ),
      },
      {
        id: "contexts",
        header: t("mwes.columns.context"),
        accessorFn: (m) => m.contexts.length,
        cell: ({ getValue }) => `${getValue<number>()}/5`,
      },
    ],
    [t, workflowLabel],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const setLanguage = (next: "TR" | "EN" | "PT") => {
    setSelected(null);
    setSearchParams(next === "TR" ? {} : { lang: next });
  };

  if (language !== "TR") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("mwes.title")}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("mwes.subtitle")}
          </p>
        </div>
        <LanguageTabs language={language} onChange={setLanguage} />
        <ReferenceInventory language={language} />
      </div>
    );
  }

  if (isLoading) return <FullPageSpinner label={t("mwes.loading")} />;
  if (isError)
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("common.dataLoadFailed", {
          message:
            error instanceof Error ? error.message : t("common.unknownError"),
        })}
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("mwes.title")}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("mwes.subtitleTr", { count: mwes.length })}{" "}
            <Badge
              variant={data?.origin === "firestore" ? "success" : "warning"}
            >
              {data?.origin === "firestore"
                ? t("common.firestore")
                : t("common.localSeed")}
            </Badge>
          </p>
        </div>
      </div>

      <LanguageTabs language={language} onChange={setLanguage} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={t("mwes.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="all">{t("mwes.allClasses")}</option>
          <option value="I">{compClassLabel("I")}</option>
          <option value="PC">{compClassLabel("PC")}</option>
          <option value="C">{compClassLabel("C")}</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t("mwes.allStatuses")}</option>
          {WORKFLOW_ORDER.map((k) => (
            <option key={k} value={k}>
              {workflowLabel(k)}
            </option>
          ))}
        </Select>
        {(search || classFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setClassFilter("all");
              setStatusFilter("all");
            }}
          >
            <X className="h-4 w-4" /> {t("common.clear")}
          </Button>
        )}
        <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))]">
          {filtered.length} {t("common.results")}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Table */}
        <Card className="overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))] shadow-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    className="border-b border-[hsl(var(--border))]"
                  >
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2 text-left font-medium"
                      >
                        {header.column.getCanSort() ? (
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
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row.original)}
                    className={`cursor-pointer border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--accent))] ${
                      selected?.id === row.original.id
                        ? "bg-[hsl(var(--accent))]"
                        : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-top">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]"
                    >
                      {t("mwes.noMatches")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Detail panel */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <MweDetail
              key={selected.id}
              mwe={selected}
              onClose={() => setSelected(null)}
              editable={
                !!profile &&
                (profile.role === "curator" || profile.role === "admin")
              }
              firestoreReady={data?.origin === "firestore"}
              onSave={async (record) => {
                if (!profile) return;
                const saved = await saveMwe(record, profile.uid);
                setSelected(saved);
                await queryClient.invalidateQueries({
                  queryKey: ["research-snapshot"],
                });
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("common.detail")}</CardTitle>
                <CardDescription>{t("mwes.detailHint")}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function LanguageTabs({
  language,
  onChange,
}: {
  language: "TR" | "EN" | "PT";
  onChange: (language: "TR" | "EN" | "PT") => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label={t("mwes.languageTabsAria")}
    >
      {(["TR", "EN", "PT"] as const).map((code) => (
        <Button
          key={code}
          role="tab"
          aria-selected={language === code}
          variant={language === code ? "default" : "outline"}
          onClick={() => onChange(code)}
        >
          {t(`mwes.tabs.${code}`)}
        </Button>
      ))}
    </div>
  );
}

function MweDetail({
  mwe,
  onClose,
  editable,
  firestoreReady,
  onSave,
}: {
  mwe: MweRecord;
  onClose: () => void;
  editable: boolean;
  firestoreReady: boolean;
  onSave: (record: MweRecord) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { workflowLabel } = useDomainLabels();
  const [meaning, setMeaning] = useState(mwe.meaning);
  const [notes, setNotes] = useState(mwe.notes);
  const [provisionalClass, setProvisionalClass] = useState<"I" | "PC" | "C">(
    mwe.provisionalClass,
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{mwe.canonicalForm}</CardTitle>
            <CardDescription>
              {mwe.id} · {mwe.modifier} + {mwe.head}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <ClassBadge value={mwe.provisionalClass} />
          <Badge variant="outline">{workflowLabel(mwe.workflowStatus)}</Badge>
          {mwe.goldScore != null && (
            <Badge>gold {mwe.goldScore.toFixed(2)}</Badge>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("common.meaning")}
          </p>
          <p className="text-sm">{mwe.meaning}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("mwes.contexts", { count: mwe.contexts.length })}
          </p>
          <div className="space-y-2">
            {mwe.contexts.map((ctx) => (
              <div
                key={ctx.id}
                className="rounded-md border border-[hsl(var(--border))] p-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    variant={ctx.family === "neutral" ? "default" : "primary"}
                  >
                    {ctx.slot}
                  </Badge>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {ctx.family}
                  </span>
                </div>
                <SpanText
                  sentence={ctx.sentence}
                  span={ctx.span}
                  surface={ctx.targetSurface}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {mwe.notes ? (
          <div>
            <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t("mwes.note")}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {mwe.notes}
            </p>
          </div>
        ) : null}
        {editable ? (
          <div className="space-y-2 border-t border-[hsl(var(--border))] pt-3">
            <p className="text-sm font-medium">
              {t("mwes.editCurationFields")}
            </p>
            <label className="block space-y-1 text-xs">
              <span>{t("common.meaning")}</span>
              <textarea
                className="w-full rounded-md border bg-transparent p-2"
                rows={3}
                value={meaning}
                onChange={(event) => setMeaning(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>{t("mwes.provisionalClass")}</span>
              <Select
                className="w-full"
                value={provisionalClass}
                onChange={(event) =>
                  setProvisionalClass(event.target.value as "I" | "PC" | "C")
                }
              >
                <option value="I">I</option>
                <option value="PC">PC</option>
                <option value="C">C</option>
              </Select>
            </label>
            <label className="block space-y-1 text-xs">
              <span>{t("common.notes")}</span>
              <textarea
                className="w-full rounded-md border bg-transparent p-2"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <Button
              disabled={!firestoreReady || saving || !meaning.trim()}
              onClick={async () => {
                setSaving(true);
                setSaveMessage(null);
                try {
                  await onSave({
                    ...mwe,
                    meaning: meaning.trim(),
                    notes: notes.trim(),
                    provisionalClass,
                  });
                  setSaveMessage(t("common.saved"));
                } catch (reason) {
                  setSaveMessage(
                    reason instanceof Error
                      ? reason.message
                      : t("common.saveFailed"),
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? t("common.saving") : t("mwes.saveChanges")}
            </Button>
            {!firestoreReady ? (
              <p className="text-xs text-[hsl(var(--warning))]">
                {t("mwes.enableFirestoreToEdit")}
              </p>
            ) : null}
            {saveMessage ? <p className="text-xs">{saveMessage}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
