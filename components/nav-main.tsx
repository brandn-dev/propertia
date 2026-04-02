"use client";

import Link from "next/link";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
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
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
          <SidebarMenu>
            {section.items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  render={<Link href={item.url} />}
                  tooltip={item.title}
                  isActive={item.isActive}
                  className="data-[active=true]:bg-sidebar-accent/80"
                >
                  {item.icon}
                  <span>{item.title}</span>
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
