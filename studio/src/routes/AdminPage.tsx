import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Globe2, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { listUsers, setUserRole, type AdminUserRow } from "@/lib/admin-users";
import { loadBundledSeed, seedResearchProject } from "@/data/repository";
import { ROLES, type Role } from "@/lib/roles";
import { useRoleLabels } from "@/i18n/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { tx } from "@/i18n";
import { publishPublicResearchDataset } from "@/lib/public-publication";

export function AdminPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.usersLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function changeRole(uid: string, role: Role) {
    setSavingUid(uid);
    setError(null);
    const prev = users;
    setUsers((u) => u.map((row) => (row.uid === uid ? { ...row, role } : row)));
    try {
      if (!profile) throw new Error(tx("errors.adminProfileMissing"));
      await setUserRole(uid, role, profile.uid);
    } catch (err) {
      setUsers(prev);
      setError(err instanceof Error ? err.message : t("admin.roleUpdateFailed"));
    } finally {
      setSavingUid(null);
    }
  }

  async function runSeed() {
    if (!profile) return;
    setSeeding(true);
    setSeedMsg(null);
    try {
      const snapshot = await loadBundledSeed();
      await seedResearchProject(snapshot, profile.uid);
      setSeedMsg(
        t("admin.firestoreSeed.success", {
          mwes: snapshot.mwes.length,
          sources: snapshot.sources.length,
          runs: snapshot.runs.length,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["research-snapshot"] });
    } catch (err) {
      setSeedMsg(
        err instanceof Error
          ? t("admin.firestoreSeed.errorPrefix", { message: err.message })
          : t("admin.firestoreSeed.failed"),
      );
    } finally {
      setSeeding(false);
    }
  }

  async function runPublicPublish() {
    if (!profile) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const counts = await publishPublicResearchDataset(profile.uid);
      setPublishMsg(
        t("admin.publicPublish.success", {
          tr: counts.TR,
          en: counts.EN,
          pt: counts.PT,
          ctrl: counts.CTRL,
        }),
      );
    } catch (err) {
      setPublishMsg(err instanceof Error ? err.message : t("admin.publicPublish.failed"));
    } finally {
      setPublishing(false);
    }
  }

  const pending = users.filter((u) => u.role === "pending");
  const others = users.filter((u) => u.role !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("admin.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> {t("common.refresh")}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> {t("admin.firestoreSeed.title")}
          </CardTitle>
          <CardDescription>{t("admin.firestoreSeed.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void runSeed()} disabled={seeding}>
            {seeding ? <Spinner className="h-4 w-4" /> : <Database className="h-4 w-4" />}
            {t("admin.firestoreSeed.loadButton")}
          </Button>
          {seedMsg ? (
            <span className="text-sm text-[hsl(var(--muted-foreground))]">{seedMsg}</span>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> {t("admin.publicPublish.title")}
          </CardTitle>
          <CardDescription>{t("admin.publicPublish.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void runPublicPublish()} disabled={publishing}>
            {publishing ? <Spinner className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
            {publishing ? t("admin.publicPublish.publishing") : t("admin.publicPublish.publishButton")}
          </Button>
          {publishMsg ? <span className="text-sm text-[hsl(var(--muted-foreground))]">{publishMsg}</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {pending.length
              ? t("admin.pending.titleWithCount", { count: pending.length })
              : t("admin.pending.title")}
          </CardTitle>
          <CardDescription>{t("admin.pending.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <Spinner className="h-4 w-4" /> {t("admin.pending.loading")}
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("admin.pending.empty")}</p>
          ) : (
            <div className="space-y-2">
              {pending.map((u) => (
                <UserRow key={u.uid} user={u} saving={savingUid === u.uid} onChange={changeRole} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.users.title", { count: others.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {others.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("admin.users.empty")}</p>
          ) : (
            <div className="space-y-2">
              {others.map((u) => (
                <UserRow
                  key={u.uid}
                  user={u}
                  saving={savingUid === u.uid}
                  onChange={changeRole}
                  isSelf={u.uid === profile?.uid}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({
  user,
  saving,
  isSelf,
  onChange,
}: {
  user: AdminUserRow;
  saving: boolean;
  isSelf?: boolean;
  onChange: (uid: string, role: Role) => void;
}) {
  const { t } = useTranslation();
  const { label: roleLabel } = useRoleLabels();

  return (
    <div className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] p-2">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted))]" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user.displayName ?? user.email}
          {isSelf ? (
            <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t("admin.users.self")}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{user.email}</p>
      </div>
      <Badge variant={user.role === "pending" ? "warning" : "default"}>
        {roleLabel(user.role)}
      </Badge>
      <Select
        value={user.role}
        disabled={saving || isSelf}
        onChange={(e) => onChange(user.uid, e.target.value as Role)}
        title={isSelf ? t("admin.users.cannotChangeOwnRole") : undefined}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </Select>
      {saving ? <Spinner className="h-4 w-4" /> : null}
    </div>
  );
}
