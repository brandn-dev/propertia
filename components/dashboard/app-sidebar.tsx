"use client";

import type { AuthUser } from "@/lib/auth/user";
import { getRouteMeta, getRoutesForRole } from "@/lib/navigation";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SidebarBrand } from "@/components/sidebar-brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

type AppSidebarProps = {
  user: AuthUser;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const routes = getRoutesForRole(user.role);
  const currentRoute = getRouteMeta(pathname);

  const sections = ["Workspace", "Operations"]
    .map((group) => ({
      title: group,
      items: routes
        .filter((route) => route.group === group)
        .map((route) => {
          const Icon = route.icon;

          return {
            title: route.title,
            url: route.href,
            badge: route.badge,
            icon: <Icon />,
            isActive: currentRoute.href === route.href,
          };
        }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:items-center">
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:items-center">
        <NavMain sections={sections} />
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:items-center">
        <NavUser
          user={{
            name: user.displayName,
            username: user.username,
            role: user.role,
          }}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
