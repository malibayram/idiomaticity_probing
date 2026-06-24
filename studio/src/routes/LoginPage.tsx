import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function LoginPage() {
  const { t } = useTranslation();
  const { firebaseUser, loading, signInWithGoogle } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/studio";
  if (!loading && firebaseUser && !firebaseUser.isAnonymous) {
    return <Navigate to={returnTo} replace />;
  }

  const handleSignIn = async () => {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.signInFailed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">NCIMP Research Studio</CardTitle>
            <LanguageSwitcher />
          </div>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={() => void handleSignIn()}
            disabled={pending}
          >
            {pending ? <Spinner className="h-4 w-4" /> : null}
            {t("login.signInGoogle")}
          </Button>
          {error ? (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          ) : null}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("login.pendingNote")}
          </p>
          <Link
            className="block text-center text-xs font-medium text-[hsl(var(--primary))] hover:underline"
            to="/"
          >
            {t("login.backToPublicSite")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
