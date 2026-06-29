import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Dashboard } from "@/routes/Dashboard";

/**
 * Role-aware studio entry point. Annotators are non-technical, so they go
 * straight to their tasks instead of the research dashboard.
 */
export function StudioHome() {
  const { profile } = useAuth();
  if (profile?.role === "annotator") {
    return <Navigate to="/studio/annotation" replace />;
  }
  return <Dashboard />;
}
