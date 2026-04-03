"use client";

import { logoutAction } from "@/app/(auth)/login/actions";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ChevronsUpDownIcon, LogOutIcon, MoonStar, SunMedium } from "lucide-react";

type NavUserProps = {
  user: {
    name: string;
    username: string;
    role: "ADMIN" | "METER_READER";
  };
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NavUser({ user }: NavUserProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
        <div className="border-t border-sidebar-border/60 px-1 pt-3 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:hover:bg-transparent"
            >
              {isCollapsed ? (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[1.15rem] bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <span className="text-sm font-medium">
                    {getInitials(user.name)}
                  </span>
                </div>
              ) : (
                <Avatar size="lg">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 max-w-[12rem] flex-1 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0">
                <p className="truncate whitespace-nowrap text-sm leading-5 font-medium text-sidebar-foreground">
                  {user.name}
                </p>
              </div>

              <ChevronsUpDownIcon className="size-4 shrink-0 text-sidebar-foreground/55 opacity-100 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:hidden" />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={10}
              className="w-56 min-w-56 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 py-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                      {ROLE_LABELS[user.role]}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-lg" showChevron={false}>
                  {resolvedTheme === "dark" ? <MoonStar /> : <SunMedium />}
                  Appearance
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  className="w-40 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
                >
                  <DropdownMenuItem
                    className="rounded-lg"
                    onClick={() => setTheme("light")}
                  >
                    <SunMedium />
                    Light
                    {resolvedTheme === "light" ? (
                      <span className="ml-auto text-xs text-muted-foreground">Active</span>
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-lg"
                    onClick={() => setTheme("dark")}
                  >
                    <MoonStar />
                    Dark
                    {resolvedTheme === "dark" ? (
                      <span className="ml-auto text-xs text-muted-foreground">Active</span>
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <form action={logoutAction} className="p-1">
                <Button
                  type="submit"
                  variant="ghost"
                  className="h-9 w-full justify-start rounded-lg"
                >
                  <LogOutIcon className="size-4" />
                  Sign out
                </Button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
