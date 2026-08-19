"use client";

import Link from "next/link";
import Image from "next/image";
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
          tooltip="Panglao Lands"
          render={<Link href="/dashboard" />}
          className={
            isCollapsed
              ? "relative mx-auto size-10! overflow-hidden rounded-xl! bg-transparent p-0!"
              : "h-12 rounded-xl bg-transparent px-2 text-sidebar-foreground hover:bg-sidebar-accent/70"
          }
        >
          {isCollapsed ? (
            <span className="flex size-10 shrink-0 items-center justify-center">
              <Image
                src="/PANGLAO%20LANDS%20LOGO%20ICON.svg"
                alt="Panglao Lands"
                width={32}
                height={32}
                unoptimized
                className="size-8! max-h-8! max-w-8! shrink-0 rounded-[3px] object-contain"
              />
            </span>
          ) : (
            <PropertiaLogo
              size="md"
              title="Panglao Lands"
              subtitle="by Propertia"
              logoSrc="/PANGLAO%20LANDS%20LOGO%20ICON.svg"
              logoAlt="Panglao Lands"
              titleClassName="tracking-[-0.025em]"
              subtitleClassName="normal-case tracking-[0.12em]"
              wordmarkClassName="max-w-[11rem] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0"
            />
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
