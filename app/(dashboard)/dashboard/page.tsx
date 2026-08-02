import { requireUser } from "@/lib/auth/user";
import { getDashboardDataForUser } from "@/lib/data/dashboard";
import {
  APP_TIME_ZONE,
  dateInputToAppStartOfDay,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  toNumber,
  toDateInputValue,
} from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { PropertiaLogo } from "@/components/propertia-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardDataForUser(user);

  if (data.kind === "admin") {
    const now = new Date();
    const todayLabel = new Intl.DateTimeFormat("en-PH", {
      timeZone: APP_TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
    const hour = Number(
      new Intl.DateTimeFormat("en-PH", {
        timeZone: APP_TIME_ZONE,
        hour: "numeric",
        hourCycle: "h23",
      }).format(now)
    );
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const todayStart = dateInputToAppStartOfDay(toDateInputValue(now));

    return (
      <AdminDashboard
        data={data.admin}
        greeting={greeting}
        userName={user.displayName}
        todayIso={todayStart.toISOString()}
        todayLabel={todayLabel}
      />
    );
  }

  const cards = [
    {
      title: "Registered meters",
      value: formatCompactNumber(data.utility.meterCount),
      detail: "Meters available for capture",
    },
    {
      title: "Shared meters",
      value: formatCompactNumber(data.utility.sharedMeters),
      detail: "Meters flagged for allocation",
    },
    {
      title: "Readings this month",
      value: formatCompactNumber(data.utility.readingsThisMonth),
      detail: "Entries recorded in the current cycle",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
          <CardContent className="p-5 md:p-6">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <PropertiaLogo size="md" subtitle="Utility reading workspace" />
                <Badge variant="secondary" className="rounded-full px-3">
                  {ROLE_LABELS[user.role]}
                </Badge>
              </div>

              <h2 className="mt-6 max-w-4xl text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
                Capture readings fast and keep billing controls separate.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                This view is intentionally lean. Meter readings feed the billing
                pipeline while contracts, invoices, and financial controls stay
                inside the admin workspace.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Workflow focus</CardDescription>
              <CardTitle className="text-2xl">Meters only</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Readings, shared meters, and utility capture stay front and center
              without exposing contract or billing administration.
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription>Next layer</CardDescription>
              <CardTitle className="text-2xl">Reading form</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              The shell is ready for a dedicated capture form with validation,
              previous-reading lookup, and rate calculation.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="rounded-xl border-border/60 bg-card shadow-sm"
          >
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {card.detail}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Recent meter activity</CardTitle>
          <CardDescription>Latest recorded readings for the assigned workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.utility.recentReadings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
              No readings recorded yet. Once meters are in place, the capture queue will appear here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meter</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.utility.recentReadings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell className="font-medium">
                      {reading.meter.meterCode}
                    </TableCell>
                    <TableCell>{reading.meter.property.name}</TableCell>
                    <TableCell>{formatDate(reading.readingDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatUtilityQuantity(
                        reading.meter.utilityType,
                        formatCompactNumber(toNumber(reading.consumption))
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(reading.totalAmount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
