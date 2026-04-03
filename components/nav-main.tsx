"use client";

import Link from "next/link";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavMainItem = {
  title: string;
  url: string;
  icon: React.ReactNode;
  isActive?: boolean;
  badge?: string;
};

type NavMainSection = {
  title: string;
  items: NavMainItem[];
};

export function NavMain({ sections }: { sections: NavMainSection[] }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const visibleSections = isCollapsed
    ? [
        {
          title: "Navigation",
          items: sections.flatMap((section) => section.items),
        },
      ]
    : sections;

  return (
    <>
      {visibleSections.map((section) => (
        <SidebarGroup
          key={section.title}
          className={isCollapsed ? "items-center px-0 py-3" : undefined}
        >
          {isCollapsed ? null : <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
          <SidebarMenu
            className={isCollapsed ? "w-full items-center gap-2" : undefined}
          >
            {section.items.map((item) => (
              <SidebarMenuItem
                key={item.url}
                className={
                  isCollapsed ? "flex w-full justify-center" : undefined
                }
              >
                <SidebarMenuButton
                  render={<Link href={item.url} />}
                  tooltip={item.title}
                  isActive={item.isActive}
                  className="data-[active=true]:bg-sidebar-accent/80 p-0! group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:rounded-xl"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center group-data-[collapsible=icon]:size-10">
                    {item.icon}
                  </span>
                  <span className="max-w-[12rem] overflow-hidden whitespace-nowrap pr-2 opacity-100 transition-[max-width,opacity,padding] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:pr-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0">
                    {item.title}
                  </span>
                </SidebarMenuButton>
                {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
