"use client";

import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
import type { NotificationSummary } from "@/lib/notification-types";
import { getRouteMeta } from "@/lib/navigation";
import { usePathname } from "next/navigation";

type DashboardHeaderProps = {
  notificationSummary: NotificationSummary;
};

export function DashboardHeader({ notificationSummary }: DashboardHeaderProps) {
  const pathname = usePathname();
  const route = getRouteMeta(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/78 backdrop-blur-2xl">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 transition-[height] duration-200 ease-[var(--ease-out-ui)] group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 md:px-6">
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
        </div>
      </div>
    </header>
  );
}
