"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { PropertiaLogo } from "@/components/propertia-logo";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Propertia"
          render={<Link href="/dashboard" />}
          className="h-auto min-h-14 rounded-[1.45rem] border border-sidebar-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.5))] px-2.5 py-2.5 shadow-[0_18px_44px_-34px_rgba(20,68,109,0.52)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:rounded-[1.25rem] group-data-[collapsible=icon]:p-1!"
        >
          <PropertiaLogo
            size="sm"
            subtitle="Operations hub"
            markClassName="group-data-[collapsible=icon]:size-10"
            wordmarkClassName="group-data-[collapsible=icon]:hidden"
          />
          <div className="ml-auto flex size-7 items-center justify-center rounded-full border border-sidebar-border/70 bg-sidebar/65 text-sidebar-foreground/75 transition-colors group-hover/menu-button:text-sidebar-primary group-data-[collapsible=icon]:hidden">
            <ArrowUpRightIcon className="size-3.5" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
