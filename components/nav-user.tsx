"use client";

import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/(auth)/login/actions";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import {
  LogOutIcon,
  MoonStar,
  Palette,
  ShieldCheck,
  SunMedium,
  UserRound,
} from "lucide-react";

type NavUserProps = {
  user: {
    id: string;
    name: string;
    username: string;
    role: AppRole;
    avatarUrl: string | null;
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
  const router = useRouter();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
        <div className="w-full border-t border-sidebar-border/60 px-1 pt-3 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className={cn(
                "flex w-full items-center gap-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isCollapsed
                  ? "mx-auto size-10 justify-center rounded-xl bg-transparent p-0 hover:bg-transparent"
                  : "rounded-xl px-2 py-2 hover:bg-sidebar-accent/55"
              )}
            >
              <Avatar size={isCollapsed ? "default" : "lg"} className="shrink-0">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={`${user.name} avatar`} />
                ) : null}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0">
                <p className="line-clamp-2 text-[1.02rem] leading-5 font-medium text-sidebar-foreground">
                  {user.name}
                </p>
                <p className="pt-1 text-sm text-sidebar-foreground/58">
                  @{user.username}
                </p>
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={10}
              className="w-56 min-w-56 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="rounded-lg"
                  onClick={() => router.push(`/users/${user.id}/edit`)}
                >
                  <UserRound />
                  My profile
                </DropdownMenuItem>
                {user.role === "ADMIN" ? (
                  <>
                    <DropdownMenuItem
                      className="rounded-lg"
                      onClick={() => router.push("/billing/invoice-templates")}
                    >
                      <Palette />
                      Invoice Templates
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-lg"
                      onClick={() => router.push("/users")}
                    >
                      <ShieldCheck />
                      Users
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-lg" showChevron={false}>
                  {resolvedTheme === "dark" ? <MoonStar /> : <SunMedium />}
                  Appearance
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  className="w-40 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
                >
                  <DropdownMenuItem className="rounded-lg" onClick={() => setTheme("light")}>
                    <SunMedium />
                    Light
                    {resolvedTheme === "light" ? (
                      <span className="ml-auto text-xs text-muted-foreground">Active</span>
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg" onClick={() => setTheme("dark")}>
                    <MoonStar />
                    Dark
                    {resolvedTheme === "dark" ? (
                      <span className="ml-auto text-xs text-muted-foreground">Active</span>
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-lg px-1.5 py-1 text-sm font-normal"
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
