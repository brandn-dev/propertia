import {
  ArrowUpRight,
  Building2,
  FileSpreadsheet,
  Gauge,
  Layers3,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth/user";
import { getDashboardDataForRole } from "@/lib/data/dashboard";
import { formatCompactNumber, formatCurrency, formatDate, toNumber } from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { PropertiaLogo } from "@/components/propertia-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Unassigned";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardDataForRole(user.role);

  if (data.role === "ADMIN") {
    const adminHighlights = [
      "Properties and unit hierarchies",
      "Tenant and contract tracking",
      "Invoice and payment workflow",
      "Meter-driven utility billing",
    ];

    const cards = [
      {
        title: "Active properties",
        value: formatCompactNumber(data.admin.propertyCount),
        detail: "Tracked spaces in the portfolio",
        icon: Building2,
      },
      {
        title: "Live contracts",
        value: formatCompactNumber(data.admin.activeContracts),
        detail: "Contracts currently in force",
        icon: FileSpreadsheet,
      },
      {
        title: "Open invoices",
        value: formatCompactNumber(data.admin.openInvoices),
        detail: "Invoices awaiting settlement",
        icon: ReceiptText,
      },
      {
        title: "Outstanding balance",
        value: formatCurrency(data.admin.outstandingBalance),
        detail: "Balance due across open invoices",
        icon: Gauge,
      },
    ];

    return (
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
            <CardContent className="p-5 md:p-6">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <PropertiaLogo size="md" subtitle="Property operations suite" />
                  <Badge variant="secondary" className="rounded-full px-3">
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </div>

                <h2 className="mt-6 max-w-4xl text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
                  Run leases, invoices, and utilities from one calm control room.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                  Propertia is now set up as a focused operations dashboard.
                  The admin workspace is ready to grow into full property,
                  tenant, contract, billing, and utility management without
                  rebuilding the shell.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {adminHighlights.map((item) => (
                    <Badge
                      key={item}
                      variant="outline"
                      className="rounded-full border-border/60 bg-background px-2.5 py-0.5 text-[0.7rem]"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="rounded-xl border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Access model
                </CardDescription>
                <CardTitle className="text-2xl">Two-role split</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                Admin handles contracts, tenants, billing, and financial views.
                Meter Reader stays in the utility workflow only.
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Layers3 className="size-4 text-primary" />
                  Build status
                </CardDescription>
                <CardTitle className="text-2xl">Foundation live</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Prisma, auth, roles, sidebar shell, and the first operational
                  pages are all wired into the live app.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
                  <ArrowUpRight className="size-3.5" />
                  Ready for CRUD flows
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.title}
                className="rounded-xl border-border/60 bg-card shadow-sm"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>{card.title}</CardDescription>
                    <CardTitle className="mt-2 text-3xl">{card.value}</CardTitle>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {card.detail}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Upcoming collections</CardTitle>
              <CardDescription>Nearest due invoices pulled from the live database.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.admin.recentInvoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
                  No invoices yet. Once billing records exist, this panel becomes the daily collections queue.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.admin.recentInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{formatTenantName(invoice.tenant)}</TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(toNumber(invoice.balanceDue))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Latest utility charges</CardTitle>
              <CardDescription>Recent meter readings feeding the billing flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.admin.recentReadings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/40 p-6 text-sm text-muted-foreground">
                  No readings yet. Utility entries recorded by the meter-reader account will appear here.
                </div>
              ) : (
                data.admin.recentReadings.map((reading) => (
                  <div
                    key={reading.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {reading.meter.property.name} · {reading.meter.meterCode}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {reading.meter.utilityType.replaceAll("_", " ")} · {formatDate(reading.readingDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(toNumber(reading.totalAmount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatUtilityQuantity(
                          reading.meter.utilityType,
                          formatCompactNumber(toNumber(reading.consumption))
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
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
