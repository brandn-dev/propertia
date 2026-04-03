"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  CircleAlert,
  Info,
  TriangleAlert,
} from "lucide-react";
import type { NotificationSummary } from "@/lib/notification-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationMenuProps = {
  summary: NotificationSummary;
};

function getSeverityIcon(severity: NotificationSummary["items"][number]["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return CircleAlert;
    case "WARNING":
      return TriangleAlert;
    default:
      return Info;
  }
}

function getSeverityTone(severity: NotificationSummary["items"][number]["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return "text-destructive";
    case "WARNING":
      return "text-amber-500";
    default:
      return "text-primary";
  }
}

export function NotificationMenu({ summary }: NotificationMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open notifications"
        className="relative inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bell className="size-4" />
        {summary.unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.62rem] font-medium text-primary-foreground">
            {summary.unreadCount > 9 ? "9+" : summary.unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-88 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {summary.unreadCount > 0
                    ? `${summary.unreadCount} unread notification${summary.unreadCount === 1 ? "" : "s"}`
                    : "No unread notifications"}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {summary.items.length === 0 ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">
            You have no notifications right now.
          </div>
        ) : (
          <div className="space-y-1">
            {summary.items.map((item) => {
              const Icon = getSeverityIcon(item.severity);

              return (
                <DropdownMenuItem
                  key={item.id}
                  className="items-start gap-3 rounded-lg px-2.5 py-2"
                  onClick={() => router.push(item.href ?? "/notifications")}
                >
                  <div className={`mt-0.5 ${getSeverityTone(item.severity)}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-1 flex-1 text-sm font-medium">
                        {item.title}
                      </p>
                      {!item.readAt ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {item.message}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rounded-lg px-2.5 py-2"
          onClick={() => router.push("/notifications")}
        >
          <Bell className="size-4" />
          View all notifications
          <ChevronRight className="ml-auto size-4 text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
