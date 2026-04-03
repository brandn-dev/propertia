import Link from "next/link";
import {
  Bell,
  CircleAlert,
  CheckCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(dashboard)/notifications/actions";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/user";
import { formatDate } from "@/lib/format";
import { getNotificationInboxForUser } from "@/lib/notifications";

function getSeverityMeta(severity: "INFO" | "WARNING" | "CRITICAL") {
  switch (severity) {
    case "CRITICAL":
      return {
        label: "Critical",
        className: "border-destructive/30 bg-destructive/10 text-destructive",
        icon: CircleAlert,
      };
    case "WARNING":
      return {
        label: "Warning",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        icon: TriangleAlert,
      };
    default:
      return {
        label: "Info",
        className: "border-primary/20 bg-primary/10 text-primary",
        icon: Info,
      };
  }
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const inbox = await getNotificationInboxForUser(user);
  const readCount = inbox.items.length - inbox.unreadCount;
  const criticalCount = inbox.items.filter(
    (item) => item.severity === "CRITICAL"
  ).length;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        title="Notifications"
        description="Persistent system alerts for invoices, expiring contracts, and utility workflows. Use this as the operational inbox for follow-up."
        icon={Bell}
        action={
          inbox.unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" className="rounded-full">
                <CheckCheck />
                Mark all read
              </Button>
            </form>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Unread"
          value={String(inbox.unreadCount)}
          detail="Notifications that still need acknowledgement."
          icon={Bell}
        />
        <DashboardMetricCard
          label="Critical"
          value={String(criticalCount)}
          detail="Current critical alerts in your inbox."
          icon={CircleAlert}
        />
        <DashboardMetricCard
          label="Read"
          value={String(readCount)}
          detail="Notifications already acknowledged."
          icon={CheckCheck}
        />
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {inbox.items.length === 0 ? (
            <DashboardEmptyState
              icon={Bell}
              title="No notifications yet"
              description="When invoices, contracts, or utility workflows need attention, alerts will appear here."
            />
          ) : (
            <div className="space-y-3">
              {inbox.items.map((item) => {
                const severity = getSeverityMeta(item.severity);
                const SeverityIcon = severity.icon;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-4 py-4 ${
                      item.readAt
                        ? "border-border/60 bg-background"
                        : "border-primary/20 bg-primary/[0.035]"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${severity.className}`}
                          >
                            <SeverityIcon className="size-3.5" />
                            {severity.label}
                          </Badge>
                          {!item.readAt ? (
                            <Badge variant="outline" className="rounded-full">
                              Unread
                            </Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>

                        <div>
                          <h2 className="text-base font-medium">{item.title}</h2>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {item.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.href ? (
                          <Button
                            render={<Link href={item.href} />}
                            variant="outline"
                            className="button-blank rounded-full"
                          >
                            Open
                          </Button>
                        ) : null}
                        {!item.readAt ? (
                          <form action={markNotificationReadAction.bind(null, item.id)}>
                            <Button
                              type="submit"
                              variant="outline"
                              className="button-blank rounded-full"
                            >
                              Mark read
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
