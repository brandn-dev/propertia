"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
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
  ChevronDown,
} from "lucide-react";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import type {
  AdminDashboardData,
  DashboardRangePreset,
} from "@/lib/data/dashboard-types";
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
  ChartResponsiveContainer,
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

const paidEarningsChartConfig = {
  rent: { label: "Rent", color: "#60a5fa" },
  charges: { label: "Charges", color: "#a78bfa" },
  cosa: { label: "COSA", color: "#f59e0b" },
  reading: { label: "Reading", color: "#34d399" },
} satisfies ChartConfig;

const DASHBOARD_RANGE_OPTIONS: Array<{
  value: DashboardRangePreset;
  label: string;
}> = [
  { value: "30D", label: "30D" },
  { value: "60D", label: "60D" },
  { value: "90D", label: "90D" },
  { value: "12M", label: "12M" },
  { value: "ALL", label: "All" },
];

function formatCompactCurrency(value: number) {
  const compact = new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
  }).format(value);

  return `₱${compact}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function getTrendMeta(
  key: AdminDashboardData["kpis"][number]["key"],
  values: number[]
) {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  const percentage =
    first === 0 ? (last === 0 ? 0 : 100) : Math.abs((delta / first) * 100);
  const isFlat = Math.abs(delta) < 0.001;
  const higherIsBetter =
    key === "occupiedSpaces";
  const isPositive = isFlat
    ? null
    : higherIsBetter
      ? delta > 0
      : delta < 0;

  if (isFlat) {
    return {
      color: "#f59e0b",
      className: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
      label: "No change",
      percentage,
    };
  }

  return isPositive
    ? {
        color: "#34d399",
        className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
        label: "Improving",
        percentage,
      }
    : {
        color: "#fb7185",
        className: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
        label: "Declining",
        percentage,
      };
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

function MiniTrend({
  color,
  values,
  className,
  width = 120,
  height = 44,
}: {
  color: string;
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return null;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-11 w-28 shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <filter id={`mini-trend-glow-${color.replace(/[^a-zA-Z0-9]/g, "")}`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
        </filter>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeOpacity="0.2"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        filter={`url(#mini-trend-glow-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function KpiCard({ kpi }: { kpi: AdminDashboardData["kpis"][number] }) {
  const meta = KPI_META[kpi.key];
  const Icon = meta.icon;
  const trendMeta = getTrendMeta(
    kpi.key,
    kpi.trend.map((point) => point.value)
  );

  return (
    <Card className="h-full rounded-2xl border-border/60 bg-card/95 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 shadow-sm"
            style={{ color: meta.color }}
          >
          <Icon className="size-4.5" />
          </div>
          <div className="min-w-0 text-lg font-semibold tracking-[-0.04em]">
            {kpi.label}
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-border/60" />

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[2.15rem] leading-none font-semibold tracking-[-0.07em] text-foreground">
              {getKpiValueLabel(kpi.key, kpi.value)}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                  trendMeta.className
                )}
              >
                {isFinite(trendMeta.percentage)
                  ? `${trendMeta.percentage >= 0 ? "+" : ""}${formatPercent(trendMeta.percentage)}`
                  : "0%"}
              </span>
              <span className="text-xs text-muted-foreground">
                {trendMeta.label}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              {kpi.detail}
            </p>
          </div>
          <MiniTrend
            color={trendMeta.color}
            values={kpi.trend.map((point) => point.value)}
          />
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

function RangePicker({
  value,
  onChange,
}: {
  value: DashboardRangePreset;
  onChange: (value: DashboardRangePreset) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DashboardRangePreset)}
        className="h-9 appearance-none rounded-full border border-border/60 bg-muted/15 py-2 pr-9 pl-3 text-[0.68rem] font-medium tracking-[0.14em] text-foreground uppercase outline-none transition-colors hover:bg-background/80"
        aria-label="Select dashboard range"
      >
        {DASHBOARD_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function MiniStatCard({
  label,
  value,
  aside,
}: {
  label: string;
  value: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-2.5 min-h-[92px]">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl leading-none font-semibold tracking-[-0.05em]">
            {value}
          </p>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </div>
  );
}

const DASHBOARD_PANEL_HEADER_CLASS =
  "flex min-h-[56px] flex-row items-center justify-between gap-3 pb-1";

function getTooltipMonthLabel(
  payload?: ReadonlyArray<{ payload?: { tooltipLabel?: string } }>
) {
  return payload?.[0]?.payload?.tooltipLabel;
}

function getDaysUntil(date: string) {
  const today = new Date();
  const target = new Date(date);
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / msPerDay));
}

function getContractHealthTone(daysLeft: number) {
  if (daysLeft <= 14) {
    return "bg-rose-500";
  }

  if (daysLeft <= 30) {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

function getRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: { tl: number; tr: number; br: number; bl: number }
) {
  const clamp = (value: number) => Math.max(0, Math.min(value, width / 2, height / 2));
  const tl = clamp(radius.tl);
  const tr = clamp(radius.tr);
  const br = clamp(radius.br);
  const bl = clamp(radius.bl);

  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr > 0 ? `Q ${x + width} ${y} ${x + width} ${y + tr}` : `L ${x + width} ${y}`,
    `V ${y + height - br}`,
    br > 0
      ? `Q ${x + width} ${y + height} ${x + width - br} ${y + height}`
      : `L ${x + width} ${y + height}`,
    `H ${x + bl}`,
    bl > 0 ? `Q ${x} ${y + height} ${x} ${y + height - bl}` : `L ${x} ${y + height}`,
    `V ${y + tl}`,
    tl > 0 ? `Q ${x} ${y} ${x + tl} ${y}` : `L ${x} ${y}`,
    "Z",
  ].join(" ");
}

function PaidStackSegmentShape({
  fill,
  height = 0,
  payload,
  width = 0,
  x = 0,
  y = 0,
  segment,
}: {
  fill?: string;
  height?: number;
  payload?: {
    rent?: number;
    charges?: number;
    cosa?: number;
    reading?: number;
  };
  width?: number;
  x?: number;
  y?: number;
  segment: "rent" | "charges" | "cosa" | "reading";
}) {
  if (!fill || width <= 0 || height <= 0) {
    return null;
  }

  const orderedSegments: Array<"rent" | "charges" | "cosa" | "reading"> = [
    "rent",
    "charges",
    "cosa",
    "reading",
  ];
  const visibleSegments = orderedSegments.filter(
    (key) => (payload?.[key] ?? 0) > 0
  );
  const firstVisible = visibleSegments[0];
  const lastVisible = visibleSegments[visibleSegments.length - 1];
  const radius = {
    tl: segment === lastVisible ? 10 : 0,
    tr: segment === lastVisible ? 10 : 0,
    br: segment === firstVisible ? 10 : 0,
    bl: segment === firstVisible ? 10 : 0,
  };

  return <path d={getRoundedRectPath(x, y, width, height, radius)} fill={fill} />;
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

        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/8 p-3 text-sky-800 dark:text-sky-100">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300">
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
                <Link
                  key={`${item.contractId}-${item.cycleStart}`}
                  href="/billing/generate"
                  className="rounded-2xl border border-sky-500/15 bg-background/70 px-3 py-3 transition-colors hover:bg-background"
                >
                  <div className="font-medium">{item.tenantName}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.propertyName}
                  </div>
                  <div className="pt-2 text-xs text-sky-600 dark:text-sky-300">
                    Invoice for {formatBillingCycleMonthLabel(item.cycleStart)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </QueueCard>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const [collectionsRange, setCollectionsRange] =
    useState<DashboardRangePreset>("ALL");
  const [utilityRange, setUtilityRange] = useState<DashboardRangePreset>("ALL");
  const [paidEarningsRange, setPaidEarningsRange] =
    useState<DashboardRangePreset>("ALL");

  const collectionsSeries = data.series.collections[collectionsRange];
  const utilitySeries = data.series.utilityCharges[utilityRange];
  const paidEarningsSeries = data.series.paidEarnings[paidEarningsRange];
  const statusSummary = data.breakdowns.invoiceStatusSummary;
  const statusMixTotal = statusSummary.totalVisible;
  const occupancySnapshot = data.breakdowns.occupancyByBuilding.reduce(
    (totals, building) => ({
      occupied: totals.occupied + building.occupied,
      vacant: totals.vacant + building.vacant,
      total: totals.total + building.total,
    }),
    { occupied: 0, vacant: 0, total: 0 }
  );
  const occupancyBuildings = data.breakdowns.occupancyByBuilding;
  const totalUtilityCharges = utilitySeries.reduce(
    (sum, item) => sum + item.charges,
    0
  );
  const totalUtilityReadings = utilitySeries.reduce(
    (sum, item) => sum + item.readings,
    0
  );
  const peakUtilityMonth = utilitySeries.reduce<
    AdminDashboardData["series"]["utilityCharges"][DashboardRangePreset][number] | null
  >((current, item) => {
    if (!current || item.charges > current.charges) {
      return item;
    }

    return current;
  }, null);
  const totalPaidEarnings = paidEarningsSeries.reduce(
    (sum, item) => sum + item.paidRevenue,
    0
  );
  const totalCollectedCharges = paidEarningsSeries.reduce(
    (sum, item) => sum + item.charges,
    0
  );
  const totalCollectedCosa = paidEarningsSeries.reduce(
    (sum, item) => sum + item.cosa,
    0
  );
  const totalCollectedReading = paidEarningsSeries.reduce(
    (sum, item) => sum + item.reading,
    0
  );
  const averagePaidEarnings =
    paidEarningsSeries.length > 0
      ? totalPaidEarnings / paidEarningsSeries.length
      : 0;

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

      <section>
        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className={DASHBOARD_PANEL_HEADER_CLASS}>
            <CardTitle>Paid earnings</CardTitle>
            <RangePicker
              value={paidEarningsRange}
              onChange={setPaidEarningsRange}
            />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 pt-1">
            <div className="grid gap-3 xl:grid-cols-5 md:grid-cols-2">
              <MiniStatCard
                label="Total collected"
                value={formatCompactCurrency(totalPaidEarnings)}
                aside={
                  <MiniTrend
                    color="#34d399"
                    values={paidEarningsSeries.map((item) => item.paidRevenue)}
                    width={84}
                    height={32}
                    className="h-8 w-20"
                  />
                }
              />
              <MiniStatCard
                label="Average per month"
                value={formatCompactCurrency(averagePaidEarnings)}
                aside={
                  <MiniTrend
                    color="#34d399"
                    values={paidEarningsSeries.map((item) => item.paidRevenue)}
                    width={84}
                    height={32}
                    className="h-8 w-20"
                  />
                }
              />
              <MiniStatCard
                label="Charges"
                value={formatCompactCurrency(totalCollectedCharges)}
              />
              <MiniStatCard
                label="COSA"
                value={formatCompactCurrency(totalCollectedCosa)}
              />
              <MiniStatCard
                label="Reading"
                value={formatCompactCurrency(totalCollectedReading)}
              />
            </div>

            <div className="h-[292px] min-h-[292px]">
              <ChartContainer config={paidEarningsChartConfig} className="h-full">
                <ChartResponsiveContainer>
                  <BarChart
                    data={paidEarningsSeries}
                    margin={{ top: 0, right: 8, left: 0, bottom: -10 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="axisKey"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      minTickGap={24}
                      tickFormatter={(_, index) =>
                        paidEarningsSeries[index]?.label ?? ""
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickMargin={4}
                      tickFormatter={(value) => formatCompactNumber(Number(value))}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                      content={(props) => {
                        const tooltip = props as unknown as {
                          active?: boolean;
                          label?: string;
                          payload?: ReadonlyArray<{
                            color?: string;
                            dataKey?: string;
                            payload?: { tooltipLabel?: string };
                            value?: number;
                          }>;
                        };

                        if (!tooltip.active || !tooltip.payload?.length) {
                          return null;
                        }

                        const total = tooltip.payload.reduce(
                          (sum, item) => sum + Number(item.value ?? 0),
                          0
                        );

                        return (
                          <div className="min-w-[200px] rounded-xl border border-border/70 bg-popover/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur">
                            <div className="mb-2 text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                              {getTooltipMonthLabel(tooltip.payload) ?? tooltip.label}
                            </div>
                            <div className="space-y-1.5">
                              {tooltip.payload.map((entry) => {
                                const key = String(
                                  entry.dataKey ?? "charges"
                                ) as keyof typeof paidEarningsChartConfig;
                                const definition = paidEarningsChartConfig[key];

                                return (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                                      <span
                                        className="size-2.5 shrink-0 rounded-full"
                                        style={{
                                          backgroundColor:
                                            entry.color ||
                                            definition?.color ||
                                            "currentColor",
                                        }}
                                      />
                                      <span className="truncate">
                                        {definition?.label ?? key}
                                      </span>
                                    </div>
                                    <span className="font-medium text-foreground">
                                      {formatCurrency(Number(entry.value ?? 0))}
                                    </span>
                                  </div>
                                );
                              })}
                              <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/60 pt-2 text-sm font-medium">
                                <span>Total</span>
                                <span>{formatCurrency(total)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="rent"
                      stackId="paid"
                      fill="var(--color-rent)"
                      maxBarSize={42}
                      shape={(props) => (
                        <PaidStackSegmentShape
                          {...(props as {
                            fill?: string;
                            height?: number;
                            payload?: {
                              rent?: number;
                              charges?: number;
                              cosa?: number;
                              reading?: number;
                            };
                            width?: number;
                            x?: number;
                            y?: number;
                          })}
                          segment="rent"
                        />
                      )}
                    />
                    <Bar
                      dataKey="charges"
                      stackId="paid"
                      fill="var(--color-charges)"
                      maxBarSize={42}
                      shape={(props) => (
                        <PaidStackSegmentShape
                          {...(props as {
                            fill?: string;
                            height?: number;
                            payload?: {
                              rent?: number;
                              charges?: number;
                              cosa?: number;
                              reading?: number;
                            };
                            width?: number;
                            x?: number;
                            y?: number;
                          })}
                          segment="charges"
                        />
                      )}
                    />
                    <Bar
                      dataKey="cosa"
                      stackId="paid"
                      fill="var(--color-cosa)"
                      maxBarSize={42}
                      shape={(props) => (
                        <PaidStackSegmentShape
                          {...(props as {
                            fill?: string;
                            height?: number;
                            payload?: {
                              rent?: number;
                              charges?: number;
                              cosa?: number;
                              reading?: number;
                            };
                            width?: number;
                            x?: number;
                            y?: number;
                          })}
                          segment="cosa"
                        />
                      )}
                    />
                    <Bar
                      dataKey="reading"
                      stackId="paid"
                      fill="var(--color-reading)"
                      maxBarSize={42}
                      shape={(props) => (
                        <PaidStackSegmentShape
                          {...(props as {
                            fill?: string;
                            height?: number;
                            payload?: {
                              rent?: number;
                              charges?: number;
                              cosa?: number;
                              reading?: number;
                            };
                            width?: number;
                            x?: number;
                            y?: number;
                          })}
                          segment="reading"
                        />
                      )}
                    />
                  </BarChart>
                </ChartResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className={DASHBOARD_PANEL_HEADER_CLASS}>
            <CardTitle>Collections trend</CardTitle>
            <RangePicker value={collectionsRange} onChange={setCollectionsRange} />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 pt-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStatCard
                label="Billed"
                value={formatCompactCurrency(
                  collectionsSeries.reduce((sum, item) => sum + item.billed, 0)
                )}
              />
              <MiniStatCard
                label="Collected"
                value={formatCompactCurrency(
                  collectionsSeries.reduce((sum, item) => sum + item.collected, 0)
                )}
              />
              <MiniStatCard
                label="Outstanding"
                value={formatCompactCurrency(
                  collectionsSeries.reduce((sum, item) => sum + item.outstanding, 0)
                )}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatCompactNumber(statusSummary.totalVisible)} invoices</span>
                <span>•</span>
                <span>{formatCompactNumber(statusSummary.paid)} paid</span>
                <span>•</span>
                <span>{formatCompactNumber(statusSummary.open)} open</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="flex h-full w-full">
                  {statusSummary.byStatus.map((item) => (
                    <div
                      key={item.status}
                      className="h-full"
                      style={{
                        width:
                          statusMixTotal === 0
                            ? "0%"
                            : `${(item.value / statusMixTotal) * 100}%`,
                        backgroundColor: statusMixChartConfig[item.status].color,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-[204px] flex-1">
              <ChartContainer config={collectionsChartConfig} className="h-full">
                <ChartResponsiveContainer>
                  <ComposedChart
                    data={collectionsSeries}
                    margin={{ top: 0, right: 8, left: 0, bottom: -10 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="axisKey"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      minTickGap={24}
                      tickFormatter={(_, index) =>
                        collectionsSeries[index]?.label ?? ""
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickMargin={4}
                      tickFormatter={(value) => formatCompactNumber(Number(value))}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                      content={(props) => (
                        <ChartTooltipContent
                          {...(props as Record<string, unknown>)}
                          labelFormatter={(label, payload) =>
                            getTooltipMonthLabel(
                              payload as ReadonlyArray<{
                                payload?: { tooltipLabel?: string };
                              }>
                            ) ?? label
                          }
                          valueFormatter={(value) => formatCurrency(value)}
                        />
                      )}
                    />
                    <Bar
                      dataKey="billed"
                      fill="var(--color-billed)"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="collected"
                      fill="var(--color-collected)"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={24}
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
                </ChartResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className={DASHBOARD_PANEL_HEADER_CLASS}>
            <CardTitle>Portfolio occupancy</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 pt-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStatCard
                label="Spaces"
                value={formatCompactNumber(occupancySnapshot.total)}
              />
              <MiniStatCard
                label="Occupied"
                value={formatCompactNumber(occupancySnapshot.occupied)}
              />
              <MiniStatCard
                label="Vacant"
                value={formatCompactNumber(occupancySnapshot.vacant)}
              />
            </div>

            {occupancyBuildings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-5 text-sm text-muted-foreground">
                No leasable spaces yet.
              </div>
            ) : (
              <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {occupancyBuildings.map((building) => {
                  const displayedUnits = Math.min(building.total, 24);
                  const occupiedUnits = Array.from(
                    { length: displayedUnits },
                    (_, index) =>
                      index <
                      Math.round((building.occupied / Math.max(building.total, 1)) * displayedUnits)
                  );

                  return (
                    <div
                      key={building.buildingId}
                      className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div
                          className="text-sm font-medium text-foreground"
                          title={building.buildingLabel}
                        >
                          {truncateLabel(building.buildingLabel, 28)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {building.occupied} occupied • {building.vacant} vacant
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {occupiedUnits.map((isOccupied, index) => (
                          <div
                            key={index}
                            className={cn(
                              "h-3.5 min-w-7 flex-1 rounded-full border border-transparent",
                              isOccupied
                                ? "bg-emerald-400"
                                : "border-slate-300/70 bg-slate-500/60 dark:border-slate-700 dark:bg-slate-600"
                            )}
                          />
                        ))}
                        {building.total > displayedUnits ? (
                          <div className="flex h-3.5 items-center rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">
                            +{building.total - displayedUnits}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className={DASHBOARD_PANEL_HEADER_CLASS}>
            <CardTitle>Utility billing pulse</CardTitle>
            <RangePicker value={utilityRange} onChange={setUtilityRange} />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 pt-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStatCard
                label="Charges"
                value={formatCompactCurrency(totalUtilityCharges)}
              />
              <MiniStatCard
                label="Readings"
                value={formatCompactNumber(totalUtilityReadings)}
              />
              <MiniStatCard label="Peak" value={peakUtilityMonth?.label ?? "None"} />
            </div>

            <div className="min-h-[204px] flex-1">
              <ChartContainer config={utilityChartConfig} className="h-full">
                <ChartResponsiveContainer>
                  <ComposedChart
                    data={utilitySeries}
                    margin={{ top: 0, right: 8, left: 0, bottom: -10 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="axisKey"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      minTickGap={24}
                      tickFormatter={(_, index) =>
                        utilitySeries[index]?.label ?? ""
                      }
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickMargin={4}
                      tickFormatter={(value) => formatCompactNumber(Number(value))}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      tickMargin={4}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                      content={(props) => (
                        <ChartTooltipContent
                          {...(props as Record<string, unknown>)}
                          labelFormatter={(label, payload) =>
                            getTooltipMonthLabel(
                              payload as ReadonlyArray<{
                                payload?: { tooltipLabel?: string };
                              }>
                            ) ?? label
                          }
                          valueFormatter={(value, key) =>
                            key === "charges"
                              ? formatCurrency(value)
                              : formatCompactNumber(value)
                          }
                        />
                      )}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="charges"
                      fill="var(--color-charges)"
                      radius={[12, 12, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      yAxisId="right"
                      dataKey="readings"
                      type="monotone"
                      stroke="var(--color-readings)"
                      strokeWidth={2.5}
                      dot={{
                        r: 4,
                        fill: "var(--color-readings)",
                        strokeWidth: 0,
                      }}
                      activeDot={{
                        r: 5,
                        fill: "var(--color-readings)",
                        strokeWidth: 0,
                      }}
                    />
                  </ComposedChart>
                </ChartResponsiveContainer>
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
              <Link
                key={invoice.id}
                href={`/billing/${invoice.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
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
              </Link>
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
            data.queues.expiringContracts.map((contract) => {
              const daysLeft = getDaysUntil(contract.endDate);
              const healthPercent = Math.max(0, Math.min(100, (daysLeft / 60) * 100));

              return (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}/edit`}
                  className="block rounded-2xl border border-border/60 bg-muted/15 p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Contract health</span>
                      <span>{daysLeft} days left</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", getContractHealthTone(daysLeft))}
                        style={{ width: `${healthPercent}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </QueueCard>
      </section>
    </div>
  );
}
