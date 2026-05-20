import {
  Building2,
  Bell,
  ShieldCheck,
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
import {
  hasCapability,
  type AppCapability,
  type AppRole,
} from "@/lib/auth/roles";

export type AppRoute = {
  title: string;
  href: string;
  description: string;
  group: "Workspace" | "Operations";
  roles?: AppRole[];
  capability?: AppCapability;
  icon: LucideIcon;
  badge?: string;
  visibleInNav?: boolean;
};

export const APP_ROUTES: AppRoute[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Portfolio health, billing, and utility activity at a glance.",
    group: "Workspace",
    capability: "VIEW_DASHBOARD",
    icon: LayoutDashboard,
  },
  {
    title: "Properties",
    href: "/properties",
    description: "Owned, leased, and nested property records.",
    group: "Workspace",
    capability: "MANAGE_PROPERTIES",
    icon: Building2,
  },
  {
    title: "Tenants",
    href: "/tenants",
    description: "Reusable tenant records and contract participation.",
    group: "Workspace",
    capability: "MANAGE_TENANTS",
    icon: Users2,
  },
  {
    title: "People",
    href: "/people",
    description: "Reusable renter and contact records linked across tenants.",
    group: "Workspace",
    capability: "MANAGE_PEOPLE",
    icon: ShieldCheck,
  },
  {
    title: "Users",
    href: "/users",
    description: "App accounts, staff access, and profile setup.",
    group: "Workspace",
    roles: ["ADMIN"],
    icon: ShieldCheck,
  },
  {
    title: "Contracts",
    href: "/contracts",
    description: "Lease terms, rent schedules, and contract status.",
    group: "Operations",
    capability: "MANAGE_CONTRACTS",
    icon: FileSpreadsheet,
  },
  {
    title: "Billing",
    href: "/billing",
    description: "Invoices, balances, and collection status.",
    group: "Operations",
    capability: "MANAGE_BILLING",
    icon: ReceiptText,
  },
  {
    title: "Invoice Templates",
    href: "/billing/invoice-templates",
    description: "Reusable invoice branding presets and property assignments.",
    group: "Operations",
    capability: "MANAGE_INVOICE_TEMPLATES",
    icon: Palette,
    visibleInNav: false,
  },
  {
    title: "Charges",
    href: "/billing/charges",
    description: "Recurring monthly contract charges like internet or parking.",
    group: "Operations",
    capability: "MANAGE_CHARGES",
    icon: Repeat2,
  },
  {
    title: "Backlog",
    href: "/billing/backlog",
    description: "Historical manual billing entry before the strict operational cutoff.",
    group: "Operations",
    capability: "MANAGE_BACKLOG",
    icon: Clock3,
    badge: "History",
  },
  {
    title: "COSA",
    href: "/billing/cosa",
    description: "Shared common charges allocated across selected tenant contracts.",
    group: "Operations",
    capability: "MANAGE_COSA",
    icon: Share2,
  },
  {
    title: "COSA Templates",
    href: "/billing/cosa/templates",
    description: "Reusable COSA presets for security, maintenance, water, and electricity.",
    group: "Operations",
    capability: "MANAGE_COSA",
    icon: CopyPlus,
  },
  {
    title: "Utilities",
    href: "/utilities",
    description: "Meter registry and the utility reading workflow.",
    group: "Operations",
    capability: "MANAGE_UTILITIES",
    icon: Gauge,
  },
  {
    title: "Meters",
    href: "/utilities/meters",
    description: "Utility meter registry and assignments.",
    group: "Operations",
    capability: "MANAGE_METERS",
    icon: Rows4,
  },
  {
    title: "Readings",
    href: "/utilities/readings",
    description: "Chronological utility reading captures.",
    group: "Operations",
    capability: "RECORD_READINGS",
    icon: ScanLine,
  },
];

type RouteUser = {
  role: AppRole;
  capabilities: AppCapability[];
};

export function canAccessRoute(route: AppRoute, user: RouteUser) {
  if (route.roles?.includes(user.role)) {
    return true;
  }

  if (!route.capability) {
    return false;
  }

  return hasCapability(user, route.capability);
}

export function getRoutesForUser(user: RouteUser) {
  return APP_ROUTES.filter(
    (route) => route.visibleInNav !== false && canAccessRoute(route, user)
  );
}

export function getRouteMeta(pathname: string) {
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
    return {
      title: "Notifications",
      href: "/notifications",
      description: "Persistent system alerts and inbox items.",
      group: "Workspace" as const,
      roles: ["ADMIN", "STAFF"] as AppRole[],
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
