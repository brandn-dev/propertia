import {
  Building2,
  Bell,
  Clock3,
  CopyPlus,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Palette,
  Repeat2,
  Rows4,
  ReceiptText,
  ScanLine,
  Share2,
  Users2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppRole } from "@/lib/auth/roles";

export type AppRoute = {
  title: string;
  href: string;
  description: string;
  group: "Workspace" | "Operations";
  roles: AppRole[];
  icon: LucideIcon;
  badge?: string;
};

export const APP_ROUTES: AppRoute[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Portfolio health, billing, and utility activity at a glance.",
    group: "Workspace",
    roles: ["ADMIN", "METER_READER"],
    icon: LayoutDashboard,
  },
  {
    title: "Properties",
    href: "/properties",
    description: "Owned, leased, and nested property records.",
    group: "Workspace",
    roles: ["ADMIN"],
    icon: Building2,
  },
  {
    title: "Tenants",
    href: "/tenants",
    description: "Reusable tenant records and contract participation.",
    group: "Workspace",
    roles: ["ADMIN"],
    icon: Users2,
  },
  {
    title: "Contracts",
    href: "/contracts",
    description: "Lease terms, rent schedules, and contract status.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: FileSpreadsheet,
  },
  {
    title: "Billing",
    href: "/billing",
    description: "Invoices, balances, and collection status.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: ReceiptText,
  },
  {
    title: "Invoice Templates",
    href: "/billing/invoice-templates",
    description: "Reusable invoice branding presets and property assignments.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: Palette,
  },
  {
    title: "Charges",
    href: "/billing/charges",
    description: "Recurring monthly contract charges like internet or parking.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: Repeat2,
  },
  {
    title: "Backlog",
    href: "/billing/backlog",
    description: "Historical manual billing entry before the strict operational cutoff.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: Clock3,
    badge: "History",
  },
  {
    title: "COSA",
    href: "/billing/cosa",
    description: "Shared common charges allocated across selected tenant contracts.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: Share2,
  },
  {
    title: "COSA Templates",
    href: "/billing/cosa/templates",
    description: "Reusable COSA presets for security, maintenance, water, and electricity.",
    group: "Operations",
    roles: ["ADMIN"],
    icon: CopyPlus,
  },
  {
    title: "Utilities",
    href: "/utilities",
    description: "Meter registry and the utility reading workflow.",
    group: "Operations",
    roles: ["ADMIN", "METER_READER"],
    icon: Gauge,
  },
  {
    title: "Meters",
    href: "/utilities/meters",
    description: "Utility meter registry and assignments.",
    group: "Operations",
    roles: ["ADMIN", "METER_READER"],
    icon: Rows4,
  },
  {
    title: "Readings",
    href: "/utilities/readings",
    description: "Chronological utility reading captures.",
    group: "Operations",
    roles: ["ADMIN", "METER_READER"],
    icon: ScanLine,
  },
];

export function getRoutesForRole(role: AppRole) {
  return APP_ROUTES.filter((route) => route.roles.includes(role));
}

export function getRouteMeta(pathname: string) {
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
    return {
      title: "Notifications",
      href: "/notifications",
      description: "Persistent system alerts and inbox items.",
      group: "Workspace" as const,
      roles: ["ADMIN", "METER_READER"] as AppRole[],
      icon: Bell,
    };
  }

  const exactMatch = APP_ROUTES.find((route) => route.href === pathname);

  if (exactMatch) {
    return exactMatch;
  }

  return (
    [...APP_ROUTES]
      .sort((left, right) => right.href.length - left.href.length)
      .find((route) => pathname.startsWith(`${route.href}/`)) ??
    APP_ROUTES[0]
  );
}
