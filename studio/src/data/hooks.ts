import { useQuery } from "@tanstack/react-query";
import {
  listProbeReviews,
  listExampleReviews,
  loadBundledSeed,
  loadAnnotationPilotPlan,
  loadKenetProbeCandidates,
  loadRandomProbeCandidates,
  loadReferenceDataset,
  loadReferenceDatasetIndex,
  loadOrdinaryControlArtifact,
  listAnnotationAggregates,
  loadAggregationReport,
  listOrdinaryControlReviews,
  loadTatoebaExampleCandidates,
  loadResearchSnapshot,
  loadValidationReport,
} from "@/data/repository";
import { useAuth } from "@/auth/AuthProvider";

export function useResearchSnapshot() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["research-snapshot", profile?.uid, profile?.role],
    queryFn: async () => {
      const remote = await loadResearchSnapshot(undefined, profile ? {
        uid: profile.uid,
        role: profile.role,
      } : undefined);
      if (remote) return { snapshot: remote, origin: "firestore" as const };
      return { snapshot: await loadBundledSeed(), origin: "bundled" as const };
    },
    enabled: !!profile && profile.role !== "pending",
  });
}

export function useKenetProbeCandidates() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["kenet-probe-candidates"],
    queryFn: loadKenetProbeCandidates,
    enabled: profile?.role === "curator" || profile?.role === "admin",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useRandomProbeCandidates() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["random-probe-candidates"],
    queryFn: loadRandomProbeCandidates,
    enabled: profile?.role === "curator" || profile?.role === "admin",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useProbeReviews() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["probe-reviews", profile?.uid, profile?.role],
    queryFn: listProbeReviews,
    enabled: !!profile && profile.role !== "pending",
  });
}

export function useValidationReport() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["tr-validation-report"],
    queryFn: loadValidationReport,
    enabled: !!profile && profile.role !== "pending",
  });
}

export function useTatoebaExampleCandidates() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["tatoeba-example-candidates"],
    queryFn: loadTatoebaExampleCandidates,
    enabled: profile?.role === "curator" || profile?.role === "admin",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useExampleReviews() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["example-reviews", profile?.uid, profile?.role],
    queryFn: listExampleReviews,
    enabled: !!profile && profile.role !== "pending",
  });
}

export function useAnnotationPilotPlan() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["tr-annotation-pilot-plan"],
    queryFn: loadAnnotationPilotPlan,
    enabled: profile?.role === "curator" || profile?.role === "admin",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useReferenceDatasetIndex() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["ncimp-reference-index"],
    queryFn: loadReferenceDatasetIndex,
    enabled: !!profile && profile.role !== "pending",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useReferenceDataset(language: "EN" | "PT", active = true) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["ncimp-reference", language],
    queryFn: () => loadReferenceDataset(language),
    enabled: active && !!profile && profile.role !== "pending",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOrdinaryControlArtifact() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["tr-ordinary-control"],
    queryFn: loadOrdinaryControlArtifact,
    enabled: profile?.role === "curator" || profile?.role === "admin",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOrdinaryControlReviews() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["ordinary-control-reviews", profile?.role],
    queryFn: listOrdinaryControlReviews,
    enabled: !!profile && profile.role !== "pending",
  });
}

export function useAnnotationAggregates() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["annotation-aggregates", profile?.role],
    queryFn: listAnnotationAggregates,
    enabled: profile?.role === "curator" || profile?.role === "admin",
  });
}

export function useAggregationReport() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["annotation-aggregation-report", profile?.role],
    queryFn: loadAggregationReport,
    enabled: profile?.role === "curator" || profile?.role === "admin",
  });
}
