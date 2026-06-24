import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { COMP_CLASS_VARIANT, WORKFLOW_ORDER } from "@/lib/domain-labels";
import { ROLES, type Role } from "@/lib/roles";
import { METRIC_KEYS, type MetricKey } from "@/lib/results-data";
import { appLocale } from "./index";

export function useFormatNumber() {
  const { i18n } = useTranslation();
  return (value: number) => value.toLocaleString(appLocale(i18n.language));
}

export function useDomainLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      COMP_CLASS_VARIANT,
      WORKFLOW_ORDER,
      compClassLabel: (cls: string) => t(`domain.compClass.${cls}`, cls),
      workflowLabel: (status: string) => t(`domain.workflow.${status}`, status),
    }),
    [t],
  );
}

export function useRoleLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      label: (role: Role) => t(`roles.labels.${role}`),
      description: (role: Role) => t(`roles.descriptions.${role}`),
      labels: Object.fromEntries(ROLES.map((role) => [role, t(`roles.labels.${role}`)])) as Record<Role, string>,
    }),
    [t],
  );
}

export function useMetricLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      keys: METRIC_KEYS,
      label: (key: MetricKey) => t(`results.metrics.${key}.label`),
      desc: (key: MetricKey) => t(`results.metrics.${key}.desc`),
    }),
    [t],
  );
}
