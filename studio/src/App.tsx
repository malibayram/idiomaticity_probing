import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/routes/LoginPage";
import { PendingPage } from "@/routes/PendingPage";
import { FullPageSpinner } from "@/components/ui/spinner";

// Public research atlas and heavy in-shell screens are code-split.
const ResearchLanding = lazy(() => import("@/routes/public/ResearchLanding").then((m) => ({ default: m.ResearchLanding })));
const PublicDataset = lazy(() => import("@/routes/public/PublicDataset").then((m) => ({ default: m.PublicDataset })));
const ApplyAnnotator = lazy(() => import("@/routes/public/ApplyAnnotator").then((m) => ({ default: m.ApplyAnnotator })));
const StudioHome = lazy(() => import("@/routes/StudioHome").then((m) => ({ default: m.StudioHome })));
const MweInventory = lazy(() => import("@/routes/MweInventory").then((m) => ({ default: m.MweInventory })));
const SourcesLibrary = lazy(() => import("@/routes/SourcesLibrary").then((m) => ({ default: m.SourcesLibrary })));
const ResultsView = lazy(() => import("@/routes/ResultsView").then((m) => ({ default: m.ResultsView })));
const AdminPage = lazy(() => import("@/routes/AdminPage").then((m) => ({ default: m.AdminPage })));
const ProbeStudio = lazy(() => import("@/routes/ProbeStudio").then((m) => ({ default: m.ProbeStudio })));
const ReleaseGate = lazy(() => import("@/routes/ReleaseGate").then((m) => ({ default: m.ReleaseGate })));
const ExperimentsView = lazy(() => import("@/routes/ExperimentsView").then((m) => ({ default: m.ExperimentsView })));
const AnnotationView = lazy(() => import("@/routes/AnnotationView").then((m) => ({ default: m.AnnotationView })));
const ExamplesLab = lazy(() => import("@/routes/ExamplesLab").then((m) => ({ default: m.ExamplesLab })));
const EnglishParityView = lazy(() => import("@/routes/EnglishParityView").then((m) => ({ default: m.EnglishParityView })));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <ResearchLanding />
            </Suspense>
          }
        />
        <Route
          path="/dataset"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <PublicDataset />
            </Suspense>
          }
        />
        <Route
          path="/apply"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <ApplyAnnotator />
            </Suspense>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/studio">
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<StudioHome />} />
              <Route path="annotation" element={<AnnotationView />} />
              <Route path="results" element={<ResultsView />} />
              <Route path="mwes" element={<MweInventory />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute roles={["curator", "admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="parity" element={<EnglishParityView />} />
              <Route path="sources" element={<SourcesLibrary />} />
              <Route path="examples" element={<ExamplesLab />} />
              <Route path="probes" element={<ProbeStudio />} />
              <Route path="release" element={<ReleaseGate />} />
              <Route path="experiments" element={<ExperimentsView />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
        {["annotation", "results", "mwes", "parity", "sources", "examples", "probes", "release", "experiments", "admin"].map((path) => (
          <Route key={path} path={`/${path}`} element={<Navigate to={`/studio/${path}`} replace />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
