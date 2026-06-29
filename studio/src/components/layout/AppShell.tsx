import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ExternalLink, LogOut, PencilLine } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NAV_GROUP_ORDER, NAV_ITEMS, type NavGroup } from "@/config/nav";
import { useRoleLabels } from "@/i18n/hooks";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const { label: roleLabel } = useRoleLabels();
  const role = profile?.role ?? "pending";

  // Annotators are non-technical; they get a single focused entry to their tasks.
  const isAnnotator = role === "annotator";
  const visible = NAV_ITEMS.filter(
    (item) => role === "admin" || item.roles.includes(role),
  );
  const groupedNav: { group: NavGroup; items: typeof visible }[] =
    NAV_GROUP_ORDER.map((group) => ({
      group,
      items: visible.filter((item) => item.group === group),
    })).filter((section) => section.items.length > 0);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
      isActive
        ? "bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]",
    );

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--border))] px-4">
          <Link to="/studio" className="text-sm font-semibold">
            {t("common.studioName")}
          </Link>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {isAnnotator ? (
            <NavLink to="/studio/annotation" className={navLinkClass}>
              <PencilLine className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t("nav.tasks")}</span>
            </NavLink>
          ) : (
            groupedNav.map((section) => (
              <div key={section.group} className="space-y-1">
                <p className="px-3 pt-1 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {t(`nav.groups.${section.group}`)}
                </p>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/studio"}
                    className={navLinkClass}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{t(item.labelKey)}</span>
                  </NavLink>
                ))}
              </div>
            ))
          )}
        </nav>
        <div className="border-t border-[hsl(var(--border))] p-3">
          <Link
            to="/"
            className="mb-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("common.publicSiteLink")}
          </Link>
          <div className="mb-2 flex items-center gap-2">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt=""
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted))]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {profile?.displayName ?? profile?.email}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {roleLabel(role)}
              </p>
            </div>
          </div>
          <div className="mb-2">
            <LanguageSwitcher className="w-full" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            {t("common.signOut")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
          <Suspense fallback={<FullPageSpinner label={t("common.loading")} />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
