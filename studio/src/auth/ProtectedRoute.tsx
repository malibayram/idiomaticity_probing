import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { FullPageSpinner } from "@/components/ui/spinner";
import { isApproved, type Role } from "@/lib/roles";

/** Requires an authenticated, approved user. Optionally restricts to roles. */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { t } = useTranslation();
  const { loading, firebaseUser, profile } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label={t("pending.checkingSession")} />;
  if (!firebaseUser || firebaseUser.isAnonymous) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!isApproved(profile?.role)) {
    return <Navigate to="/pending" replace />;
  }
  if (roles && profile && !roles.includes(profile.role) && profile.role !== "admin") {
    return <Navigate to="/studio" replace />;
  }
  return <Outlet />;
}
