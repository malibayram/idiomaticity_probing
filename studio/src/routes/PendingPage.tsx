import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isApproved } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageSpinner } from "@/components/ui/spinner";

export function PendingPage() {
  const { t } = useTranslation();
  const { loading, firebaseUser, profile, signOut } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!firebaseUser || firebaseUser.isAnonymous) return <Navigate to="/login" replace />;
  if (isApproved(profile?.role)) return <Navigate to="/studio" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{t("pending.title")}</CardTitle>
            <LanguageSwitcher />
          </div>
          <CardDescription>
            {t("pending.description", { email: profile?.email })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void signOut()}>
            {t("common.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
