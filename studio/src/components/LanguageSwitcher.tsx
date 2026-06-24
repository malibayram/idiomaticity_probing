import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { setUserLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = i18n.language.startsWith("tr") ? "tr" : "en";

  return (
    <div
      className={cn("inline-flex rounded-md border border-[hsl(var(--border))] p-0.5", className)}
      role="group"
      aria-label={t("common.language")}
    >
      {(["en", "tr"] as const).map((lng) => (
        <Button
          key={lng}
          type="button"
          size="sm"
          variant={current === lng ? "default" : "ghost"}
          className="h-7 px-2 text-xs"
          onClick={() => setUserLanguage(lng)}
        >
          {lng.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
