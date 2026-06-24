import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Database, LogIn } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const sectionHrefs = [
  ["nav.purpose", "#amac"],
  ["nav.method", "#yontem"],
  ["nav.metrics", "#metrikler"],
  ["nav.experiments", "#deneyler"],
  ["nav.findings", "#bulgular"],
  ["nav.transparency", "#seffaflik"],
] as const;

export function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { firebaseUser, profile } = useAuth();
  const hasStudioAccount = !!firebaseUser && !firebaseUser.isAnonymous;

  return (
    <header className="sticky top-0 z-50 border-b border-[#d8d4c8]/80 bg-[#f5f2e9]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3 overflow-hidden px-4 sm:gap-6 sm:px-6 lg:px-10">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#132b2b] font-serif text-sm font-bold text-[#f4c95d]">
            N
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-[-0.02em] text-[#132b2b]">NCIMP / IdiomProbe</span>
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[#6f746c] sm:block">{t("public.header.brandSubtitle")}</span>
          </span>
        </Link>

        {!compact ? (
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label={t("public.header.navAriaLabel")}>
            {sectionHrefs.map(([key, href]) => (
              <a key={href} href={href} className="rounded-full px-3 py-2 text-xs font-semibold text-[#4d5a55] hover:bg-white/70 hover:text-[#132b2b]">
                {t(`public.header.${key}`)}
              </a>
            ))}
          </nav>
        ) : <div className="flex-1" />}

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher className="border-[#b9c7c0] bg-white/70" />
          <Link
            to="/dataset"
            className="hidden items-center gap-2 rounded-full border border-[#b9c7c0] bg-white/70 px-4 py-2 text-xs font-bold text-[#183c3a] hover:bg-white sm:flex"
          >
            <Database className="h-3.5 w-3.5" /> {t("public.header.allExamples")}
          </Link>
          <Link
            to={hasStudioAccount && profile?.role !== "pending" ? "/studio" : "/login"}
            className="flex shrink-0 items-center gap-2 rounded-full bg-[#132b2b] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1d403e] sm:px-4"
            aria-label={hasStudioAccount ? t("public.header.ariaGoToStudio") : t("public.header.ariaAnnotatorLogin")}
          >
            {hasStudioAccount ? <ArrowUpRight className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{hasStudioAccount ? t("public.header.goToStudio") : t("public.header.annotatorLogin")}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
