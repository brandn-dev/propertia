"use client";

import Link from "next/link";
import { Building2Icon } from "lucide-react";
import { PropertiaLogo } from "@/components/propertia-logo";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function SidebarBrand() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
        <SidebarMenuButton
          size="lg"
          tooltip="Propertia"
          render={<Link href="/dashboard" />}
          className={
            isCollapsed
              ? "relative mx-auto size-10! overflow-hidden rounded-[0.95rem]! bg-[linear-gradient(145deg,var(--brand-gradient-start)_0%,var(--brand-gradient-middle)_58%,var(--brand-gradient-end)_100%)] p-0! text-white shadow-lg shadow-primary/15 hover:text-white"
              : "h-12 rounded-xl bg-transparent px-2 text-sidebar-foreground hover:bg-sidebar-accent/70"
          }
        >
          {isCollapsed ? (
            <>
              <div className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.3),_transparent_48%)]" />
              <div className="relative flex size-10 shrink-0 items-center justify-center">
                <Building2Icon className="size-5" aria-hidden="true" />
              </div>
            </>
          ) : (
            <PropertiaLogo
              size="sm"
              subtitle="Operations hub"
              wordmarkClassName="max-w-[11rem] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0"
            />
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
