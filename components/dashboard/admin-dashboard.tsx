"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BellRing,
  Building2,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import type { AdminDashboardData } from "@/lib/data/dashboard-types";
import { formatCompactNumber, formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";

const KPI_META = {
  openInvoices: {
    icon: ReceiptText,
    color: "#38bdf8",
  },
  outstandingBalance: {
    icon: CreditCard,
    color: "#fb7185",
  },
  occupiedSpaces: {
    icon: Building2,
    color: "#34d399",
  },
  contractsExpiringSoon: {
    icon: CalendarClock,
    color: "#f59e0b",
  },
} satisfies Record<
  AdminDashboardData["kpis"][number]["key"],
  { icon: typeof ReceiptText; color: string }
>;

const collectionsChartConfig = {
  billed: { label: "Billed", color: "#38bdf8" },
  collected: { label: "Collected", color: "#34d399" },
  outstanding: { label: "Outstanding", color: "#f59e0b" },
} satisfies ChartConfig;

const occupancyChartConfig = {
  occupied: { label: "Occupied", color: "#34d399" },
  vacant: { label: "Vacant", color: "#334155" },
} satisfies ChartConfig;

const statusMixChartConfig = {
  PAID: { label: "Paid", color: "#34d399" },
  OVERDUE: { label: "Overdue", color: "#fb7185" },
  PARTIALLY_PAID: { label: "Partial", color: "#f59e0b" },
  ISSUED: { label: "Issued", color: "#38bdf8" },
} satisfies ChartConfig;

const utilityChartConfig = {
  charges: { label: "Utility charges", color: "#22d3ee" },
  readings: { label: "Readings", color: "#a78bfa" },
} satisfies ChartConfig;

function formatCompactCurrency(value: number) {
  const compact = new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
  }).format(value);

  return `₱${compact}`;
}

function getKpiValueLabel(key: AdminDashboardData["kpis"][number]["key"], value: number) {
  if (key === "outstandingBalance") {
    return formatCompactCurrency(value);
  }

  return formatCompactNumber(value);
}

function getStatusTone(status: AdminDashboardData["queues"]["dueSoon"][number]["status"]) {
  switch (status) {
    case "OVERDUE":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    case "PARTIALLY_PAID":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  }
}

function getReminderTone(tone: NonNullable<AdminDashboardData["reminders"]["items"][number]["tone"]>) {
  switch (tone) {
    case "critical":
      return "border-rose-500/25 bg-rose-500/10";
    case "warning":
      return "border-amber-500/25 bg-amber-500/10";
    default:
      return "border-border/60 bg-muted/15";
  }
}

function truncateLabel(value: string, max = 14) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}…`;
}

function KpiCard({ kpi }: { kpi: AdminDashboardData["kpis"][number] }) {
  const meta = KPI_META[kpi.key];
  const Icon = meta.icon;

  return (
    <Card className="h-full rounded-2xl border-border/60 bg-card/95 shadow-sm">
      <CardContent className="min-h-[118px] p-4">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
        >
          <Icon className="size-4.5" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="text-[0.72rem] leading-none font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {kpi.label}
            </div>
            <div className="pt-2.5 text-[2.05rem] leading-none font-semibold tracking-[-0.06em] text-foreground">
              {getKpiValueLabel(kpi.key, kpi.value)}
            </div>
            <p className="pt-2 text-sm leading-5 text-muted-foreground">
              {kpi.detail}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HeaderActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/contracts/new" />}
      >
        <FileSpreadsheet className="size-3.5" />
        New contract
      </Button>
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/billing/generate" />}
      >
        <ReceiptText className="size-3.5" />
        Generate invoices
      </Button>
      <Button
        size="sm"
        render={<Link href="/utilities/readings/new" />}
      >
        <Sparkles className="size-3.5" />
        Record reading
      </Button>
    </div>
  );
}

function QueueCard({
  title,
  description,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="gap-1 border-b border-border/60 pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={actionHref} />}
          >
            {actionLabel}
            <ArrowUpRight className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">{children}</CardContent>
    </Card>
  );
}

function RemindersCard({ data }: { data: AdminDashboardData["reminders"] }) {
  return (
    <QueueCard
      title="Reminders"
      description="Immediate billing attention points and upcoming billable businesses."
      actionHref="/billing/generate"
      actionLabel="Open generate"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          {data.items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-2xl border px-3 py-3",
                getReminderTone(item.tone ?? "default")
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  {item.detail ? (
                    <div className="pt-1 text-xs text-muted-foreground">
                      {item.detail}
                    </div>
                  ) : null}
                </div>
                <div className="text-lg font-semibold tracking-[-0.04em]">
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <BellRing className="size-4" />
            <div className="text-sm font-medium">Upcoming billable businesses</div>
          </div>

          {data.nearestBillables.length === 0 ? (
            <div className="pt-3 text-sm text-muted-foreground">
              No billable business ready right now.
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {data.nearestBillables.map((item) => (
                <div
                  key={`${item.contractId}-${item.cycleStart}`}
                  className="rounded-2xl border border-cyan-400/20 bg-background/30 px-3 py-3"
                >
                  <div className="font-medium">{item.tenantName}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.propertyName}
                  </div>
                  <div className="pt-2 text-xs text-cyan-200/90">
                    Invoice for {formatBillingCycleMonthLabel(item.cycleStart)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </QueueCard>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const statusMixTotal = data.breakdowns.invoiceStatusMix.reduce(
    (total, item) => total + item.value,
    0
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily cockpit for billing, occupancy, contracts, and utility flow.
          </p>
        </div>

        <HeaderActions />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="gap-1 border-b border-border/60 pb-4">
            <CardTitle>Collections trend</CardTitle>
            <CardDescription>Last 6 months of billed, collected, and still-outstanding amounts.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px]">
              <ChartContainer config={collectionsChartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.series.collections}
                    margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickMargin={8}
                      tickFormatter={(value) => formatCompactNumber(Number(value))}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={(props) => (
                        <ChartTooltipContent
                          {...(props as Record<string, unknown>)}
                          valueFormatter={(value) => formatCurrency(value)}
                        />
                      )}
                    />
                    <Bar
                      dataKey="billed"
                      fill="var(--color-billed)"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="collected"
                      fill="var(--color-collected)"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={28}
                    />
                    <Area
                      type="monotone"
                      dataKey="outstanding"
                      stroke="var(--color-outstanding)"
                      fill="var(--color-outstanding)"
                      fillOpacity={0.14}
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="gap-1 border-b border-border/60 pb-4">
            <CardTitle>Portfolio occupancy</CardTitle>
            <CardDescription>
              Occupied versus vacant spaces by building.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data.breakdowns.occupancyByBuilding.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
                No leasable spaces yet.
              </div>
            ) : (
              <div className="h-[280px]">
                <ChartContainer config={occupancyChartConfig}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.breakdowns.occupancyByBuilding.slice(0, 6)}
                      layout="vertical"
                      barGap={6}
                      margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="buildingLabel"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={118}
                        tickMargin={8}
                        tickFormatter={(value: string) => truncateLabel(value)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={(props) => (
                          <ChartTooltipContent
                            {...(props as Record<string, unknown>)}
                            valueFormatter={(value, key) =>
                              `${value} ${key === "occupied" ? "occupied" : "vacant"}`
                            }
                          />
                        )}
                      />
                      <Bar
                        dataKey="occupied"
                        stackId="spaces"
                        radius={[10, 0, 0, 10]}
                        fill="var(--color-occupied)"
                      />
                      <Bar
                        dataKey="vacant"
                        stackId="spaces"
                        radius={[0, 10, 10, 0]}
                        fill="var(--color-vacant)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="gap-1 border-b border-border/60 pb-4">
            <CardTitle>Invoice status mix</CardTitle>
            <CardDescription>Snapshot of paid and still-open invoice states.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
            {statusMixTotal === 0 ? (
              <div className="sm:col-span-2 rounded-2xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
                No invoices yet.
              </div>
            ) : (
              <>
                <div className="h-[220px]">
                  <ChartContainer config={statusMixChartConfig}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={(props) => (
                            <ChartTooltipContent
                              {...(props as Record<string, unknown>)}
                              hideLabel
                            />
                          )}
                        />
                        <Pie
                          data={data.breakdowns.invoiceStatusMix}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={64}
                          outerRadius={84}
                          strokeWidth={0}
                        >
                          <Label
                            content={({ viewBox }) => {
                              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                                return null;
                              }

                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy - 4}
                                    className="fill-foreground text-2xl font-semibold"
                                  >
                                    {formatCompactNumber(statusMixTotal)}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy + 16}
                                    className="fill-muted-foreground text-xs"
                                  >
                                    invoices
                                  </tspan>
                                </text>
                              );
                            }}
                          />
                          {data.breakdowns.invoiceStatusMix.map((item) => (
                            <Cell
                              key={item.status}
                              fill={statusMixChartConfig[item.status].color}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>

                <div className="space-y-3">
                  {data.breakdowns.invoiceStatusMix.map((item) => (
                    <div
                      key={item.status}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: statusMixChartConfig[item.status].color }}
                        />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCompactNumber(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="gap-1 border-b border-border/60 pb-4">
            <CardTitle>Utility billing pulse</CardTitle>
            <CardDescription>Meter-reading charges recorded across the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px]">
              <ChartContainer config={utilityChartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.series.utilityCharges}
                    margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickMargin={8}
                      tickFormatter={(value) => formatCompactNumber(Number(value))}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={(props) => (
                        <ChartTooltipContent
                          {...(props as Record<string, unknown>)}
                          valueFormatter={(value, key) =>
                            key === "charges"
                              ? formatCurrency(value)
                              : formatCompactNumber(value)
                          }
                        />
                      )}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="charges"
                      stroke="var(--color-charges)"
                      fill="var(--color-charges)"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="readings"
                      fill="var(--color-readings)"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={18}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <RemindersCard data={data.reminders} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <QueueCard
          title="Collections queue"
          description="Nearest unpaid invoices sorted by due date."
          actionHref="/billing"
          actionLabel="Open billing"
        >
          {data.queues.dueSoon.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
              No unpaid invoices right now.
            </div>
          ) : (
            data.queues.dueSoon.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{invoice.invoiceNumber}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {invoice.tenantName} · {invoice.propertyName}
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:text-right">
                  <div>
                    <div className="text-sm font-medium">{formatCurrency(invoice.balanceDue)}</div>
                    <div className="text-xs text-muted-foreground">
                      Due {formatDate(invoice.dueDate)}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("rounded-full px-2.5 py-0.5", getStatusTone(invoice.status))}
                  >
                    {invoice.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </QueueCard>

        <QueueCard
          title="Expiring contracts"
          description="Active contracts ending first."
          actionHref="/contracts"
          actionLabel="Open contracts"
        >
          {data.queues.expiringContracts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
              No active contracts are nearing expiry.
            </div>
          ) : (
            data.queues.expiringContracts.map((contract) => (
              <div
                key={contract.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{contract.tenantName}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {contract.propertyName}
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-sm font-medium">
                    Ends {formatDate(contract.endDate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(contract.monthlyRent)} / month
                  </div>
                </div>
              </div>
            ))
          )}
        </QueueCard>
      </section>
    </div>
  );
}
