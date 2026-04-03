"use client";

import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { NotificationMenu } from "@/components/dashboard/notification-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import type { AuthUser } from "@/lib/auth/user";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { NotificationSummary } from "@/lib/notification-types";
import { getRouteMeta } from "@/lib/navigation";
import { usePathname } from "next/navigation";
import { PanelTopOpen } from "lucide-react";

type DashboardHeaderProps = {
  user: AuthUser;
  notificationSummary: NotificationSummary;
};

export function DashboardHeader({
  user,
  notificationSummary,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const route = getRouteMeta(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/78 backdrop-blur-2xl">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ml-1 rounded-full" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink render={<Link href="/dashboard" />}>
                  {route.group}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{route.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <NotificationMenu summary={notificationSummary} />
          <Badge
            variant="secondary"
            className="hidden rounded-full border border-border/60 bg-card/80 px-3 md:inline-flex"
          >
            <PanelTopOpen className="size-3.5" />
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>
      </div>
    </header>
  );
}
