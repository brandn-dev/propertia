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
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import {
  Check,
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

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
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
                "flex w-full items-center gap-3 text-left outline-none transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out-ui)] focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-[0.98]",
                isCollapsed
                  ? "mx-auto size-10 justify-center rounded-xl bg-transparent p-0 hover:bg-transparent"
                  : "rounded-xl border border-sidebar-border/80 bg-sidebar-accent/45 px-2.5 py-2.5 shadow-xs hover:border-sidebar-primary/30 hover:bg-sidebar-accent/70"
              )}
            >
              <span className="relative shrink-0">
                <Avatar size={isCollapsed ? "default" : "lg"}>
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={`${user.name} avatar`} />
                  ) : null}
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden="true"
                  className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-sidebar bg-success"
                />
              </span>

              <div className="min-w-0 flex-1 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0">
                <p className="whitespace-nowrap text-sm leading-5 font-semibold tracking-[-0.01em] text-sidebar-foreground">
                  {getFirstName(user.name)}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-sidebar-foreground/58">
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={10}
              className="w-56 min-w-56 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Signed in</p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
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
                  className="h-auto w-full justify-start rounded-lg px-1.5 py-1 text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
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
