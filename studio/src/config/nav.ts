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
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Roles allowed to see/use this module. `admin` is always allowed. */
  roles: Role[];
}

// All listed modules are implemented routes; incomplete modules must not be added here.
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/studio",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: ["viewer", "annotator", "curator", "admin"],
  },
  {
    to: "/studio/sources",
    labelKey: "nav.sources",
    icon: Library,
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/mwes",
    labelKey: "nav.mwes",
    icon: ListTree,
    roles: ["viewer", "annotator", "curator", "admin"],
  },
  {
    to: "/studio/examples",
    labelKey: "nav.examples",
    icon: FlaskConical,
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/annotation",
    labelKey: "nav.annotation",
    icon: PencilLine,
    roles: ["annotator", "curator", "admin"],
  },
  {
    to: "/studio/probes",
    labelKey: "nav.probes",
    icon: TestTubes,
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/release",
    labelKey: "nav.release",
    icon: ShieldCheck,
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/experiments",
    labelKey: "nav.experiments",
    icon: Cpu,
    roles: ["curator", "admin"],
  },
  {
    to: "/studio/results",
    labelKey: "nav.results",
    icon: BarChart3,
    roles: ["viewer", "curator", "admin"],
  },
  {
    to: "/studio/admin",
    labelKey: "nav.admin",
    icon: Users,
    roles: ["admin"],
  },
];
