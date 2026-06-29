import {
  LayoutDashboard,
  Library,
  ListTree,
  FlaskConical,
  PencilLine,
  TestTubes,
  ShieldCheck,
  Cpu,
  BarChart3,
  Languages,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

/** Workflow-phase sections that group the modules in the sidebar. */
export type NavGroup =
  | "general"
  | "dataset"
  | "annotation"
  | "analysis"
  | "admin";

/** Render order of the sidebar groups. */
export const NAV_GROUP_ORDER: NavGroup[] = [
  "general",
  "dataset",
  "annotation",
  "analysis",
  "admin",
];

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Workflow phase this module belongs to. */
  group: NavGroup;
  /** Roles allowed to see/use this module. `admin` is always allowed. */
  roles: Role[];
}

// All listed modules are implemented routes; incomplete modules must not be added here.
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/studio",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    group: "general",
    roles: ["viewer", "annotator", "curator", "admin"],
  },
  {
    to: "/studio/sources",
    labelKey: "nav.sources",
    icon: Library,
    group: "dataset",
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/mwes",
    labelKey: "nav.mwes",
    icon: ListTree,
    group: "dataset",
    roles: ["viewer", "annotator", "curator", "admin"],
  },
  {
    to: "/studio/examples",
    labelKey: "nav.examples",
    icon: FlaskConical,
    group: "dataset",
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/probes",
    labelKey: "nav.probes",
    icon: TestTubes,
    group: "dataset",
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/annotation",
    labelKey: "nav.annotation",
    icon: PencilLine,
    group: "annotation",
    roles: ["annotator", "curator", "admin"],
  },
  {
    to: "/studio/release",
    labelKey: "nav.release",
    icon: ShieldCheck,
    group: "analysis",
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/experiments",
    labelKey: "nav.experiments",
    icon: Cpu,
    group: "analysis",
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/results",
    labelKey: "nav.results",
    icon: BarChart3,
    group: "analysis",
    roles: ["viewer", "curator", "admin"],
  },
  {
    to: "/studio/parity",
    labelKey: "nav.parity",
    icon: Languages,
    group: "analysis",
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/admin",
    labelKey: "nav.admin",
    icon: Users,
    group: "admin",
    roles: ["admin"],
  },
];
