"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { logoutAction } from "@/app/(auth)/login/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { LogOutIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";

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
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="rounded-[1.35rem] border border-sidebar-border/60 bg-sidebar-accent/35 p-2.5">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <Avatar className="rounded-xl">
              <AvatarFallback className="rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                @{user.username}
              </span>
            </div>
            {user.role === "ADMIN" ? (
              <ShieldCheckIcon className="size-4 text-sidebar-primary group-data-[collapsible=icon]:hidden" />
            ) : (
              <ZapIcon className="size-4 text-sidebar-primary group-data-[collapsible=icon]:hidden" />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:justify-center">
            <span className="rounded-full bg-sidebar/75 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
              {ROLE_LABELS[user.role]}
            </span>
            <form action={logoutAction}>
              <SidebarMenuButton
                type="submit"
                tooltip="Sign out"
                className="h-9 rounded-full border border-sidebar-border/60 bg-sidebar/70 px-3 hover:bg-sidebar-accent/90 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0!"
              >
                <LogOutIcon className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
              </SidebarMenuButton>
            </form>
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
