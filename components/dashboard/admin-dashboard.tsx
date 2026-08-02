"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Droplets,
  FileText,
  PhilippinePeso,
  Plus,
  ReceiptText,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import type { AdminDashboardData } from "@/lib/data/dashboard-types";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type QueueFilter = "all" | "invoice" | "contract" | "billing";

type AttentionItem = {
  key: string;
  kind: Exclude<QueueFilter, "all">;
  title: string;
  subtitle: string;
  timing: string;
  amount: number | null;
  note: string;
  href: string;
  tone: "critical" | "warning" | "info";
};

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "invoice", label: "Invoices" },
  { value: "contract", label: "Contracts" },
  { value: "billing", label: "Billable" },
];

const ITEM_ICONS = {
  invoice: ReceiptText,
  contract: FileText,
  billing: CalendarClock,
};

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function getDaysDifference(targetValue: string, todayValue: string) {
  const target = new Date(targetValue);
  const today = new Date(todayValue);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil((target.getTime() - today.getTime()) / dayMs);
}

function getInvoiceTiming(
  invoice: AdminDashboardData["queues"]["dueSoon"][number],
  todayIso: string
) {
  const days = getDaysDifference(invoice.dueDate, todayIso);

  if (invoice.status === "OVERDUE" || days < 0) {
    const overdueDays = Math.max(Math.abs(days), 1);
    return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
  }

  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function getContractTiming(endDate: string, todayIso: string) {
  const days = Math.max(getDaysDifference(endDate, todayIso), 0);
  if (days === 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

function getToneClasses(tone: AttentionItem["tone"]) {
  switch (tone) {
    case "critical":
      return "bg-destructive/10 text-destructive";
    case "warning":
      return "bg-warning/12 text-warning-foreground";
    default:
      return "bg-info/10 text-info";
  }
}

function getReminderTone(
  tone: AdminDashboardData["reminders"]["items"][number]["tone"]
) {
  switch (tone) {
    case "critical":
      return "border-destructive/25 bg-destructive/8";
    case "warning":
      return "border-warning/25 bg-warning/8";
    default:
      return "border-border/70 bg-card";
  }
}

export function AdminDashboard({
  data,
  greeting,
  userName,
  todayIso,
  todayLabel,
}: {
  data: AdminDashboardData;
  greeting: string;
  userName: string;
  todayIso: string;
  todayLabel: string;
}) {
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const invoiceItems: AttentionItem[] = data.queues.dueSoon.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      kind: "invoice",
      title: invoice.tenantName,
      subtitle: `${invoice.invoiceNumber} · ${invoice.propertyName}`,
      timing: getInvoiceTiming(invoice, todayIso),
      amount: invoice.balanceDue,
      note:
        invoice.status === "OVERDUE"
          ? "Payment is past due. Review history and follow up with the tenant."
          : invoice.status === "PARTIALLY_PAID"
            ? "Partial payment recorded. Review remaining balance before follow-up."
            : "Payment has not been recorded. Review invoice and tenant activity.",
      href: `/billing/${invoice.id}`,
      tone: invoice.status === "OVERDUE" ? "critical" : "warning",
    }));

    const contractItems: AttentionItem[] = data.queues.expiringContracts.map(
      (contract) => ({
        key: `contract-${contract.id}`,
        kind: "contract",
        title: contract.tenantName,
        subtitle: `${contract.propertyName} · ${formatCurrency(contract.monthlyRent)}/month`,
        timing: getContractTiming(contract.endDate, todayIso),
        amount: contract.monthlyRent,
        note: "Contract approaches its end date. Review renewal, extension, or handoff steps.",
        href: `/contracts/${contract.id}/edit`,
        tone: getDaysDifference(contract.endDate, todayIso) <= 14 ? "critical" : "warning",
      })
    );

    const billableItems: AttentionItem[] = data.reminders.nearestBillables.map(
      (billable) => ({
        key: `billable-${billable.contractId}-${billable.cycleStart}`,
        kind: "billing",
        title: billable.tenantName,
        subtitle: billable.propertyName,
        timing: `Invoice for ${formatBillingCycleMonthLabel(billable.cycleStart)}`,
        amount: null,
        note: "Billing cycle is ready. Review readings, recurring charges, COSA, and adjustments before generation.",
        href: `/billing/generate?contractId=${encodeURIComponent(billable.contractId)}`,
        tone: "info",
      })
    );

    return [...invoiceItems, ...contractItems, ...billableItems];
  }, [data, todayIso]);

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [selectedKey, setSelectedKey] = useState(attentionItems[0]?.key ?? "");
  const visibleItems = attentionItems.filter(
    (item) => filter === "all" || item.kind === filter
  );
  const selected =
    visibleItems.find((item) => item.key === selectedKey) ?? visibleItems[0] ?? null;

  const occupancyRate = data.summary.totalSpaces
    ? Math.round((data.summary.occupiedSpaces / data.summary.totalSpaces) * 1000) / 10
    : 0;

  const kpis = [
    {
      label: "Open invoices",
      value: formatCompactNumber(data.summary.openInvoices),
      detail: "Issued, partial, and overdue",
      icon: AlertCircle,
      tone: data.summary.openInvoices > 0 ? "text-warning" : "text-success",
      href: "/billing",
    },
    {
      label: "Outstanding",
      value: formatCurrency(data.summary.outstandingBalance),
      detail: "Across unpaid invoices",
      icon: PhilippinePeso,
      tone: data.summary.outstandingBalance > 0 ? "text-warning" : "text-success",
      href: "/billing",
    },
    {
      label: "Occupied",
      value: `${data.summary.occupiedSpaces} / ${data.summary.totalSpaces}`,
      detail: `${occupancyRate}% portfolio occupancy`,
      icon: CheckCircle2,
      tone: "text-success",
      href: "/properties",
    },
    {
      label: "Expiring soon",
      value: formatCompactNumber(data.summary.contractsExpiringSoon),
      detail: "Active contracts within 60 days",
      icon: CalendarClock,
      tone: data.summary.contractsExpiringSoon > 0 ? "text-info" : "text-success",
      href: "/contracts",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">{todayLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            {greeting}, {getFirstName(userName)}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Clear today&apos;s billing and property exceptions first.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/billing/generate"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium transition-transform duration-150 ease-[var(--ease-out-ui)] active:scale-[0.97]"
          >
            <ReceiptText className="size-4" />
            Generate invoices
          </Link>
          <Link
            href="/utilities/readings/new"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform duration-150 ease-[var(--ease-out-ui)] active:scale-[0.97]"
          >
            <Sparkles className="size-4" />
            Record readings
          </Link>
        </div>
      </section>

      <section className="grid border-y border-border/70 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, detail, icon: Icon, tone, href }, index) => (
          <Link
            key={label}
            href={href}
            aria-label={`Open ${label.toLowerCase()}`}
            className={cn(
              "group flex min-w-0 items-start justify-between gap-4 py-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              index > 0 && "sm:border-l sm:border-border/70 sm:pl-4",
              index < kpis.length - 1 && "xl:pr-4"
            )}
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-2xl font-semibold tracking-[-0.05em]">
                {value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </div>
            <Icon
              className={cn(
                "mt-1 size-4 shrink-0 transition-colors group-hover:text-primary",
                tone
              )}
              aria-hidden="true"
            />
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold tracking-[-0.02em]">Attention queue</h2>
              <p className="text-xs text-muted-foreground">
                Unpaid invoices, expiring contracts, and ready billing cycles.
              </p>
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    filter === item.value
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto size-5 text-success" />
              <p className="mt-2 text-sm font-medium">Nothing in this queue</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No matching item needs attention right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {visibleItems.map((item) => {
                const Icon = ITEM_ICONS[item.kind];
                const isSelected = item.key === selected?.key;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onMouseEnter={() => setSelectedKey(item.key)}
                    onFocus={() => setSelectedKey(item.key)}
                    className={cn(
                      "grid w-full gap-3 px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center",
                      isSelected ? "bg-primary/7" : "hover:bg-muted/35"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-lg",
                        getToneClasses(item.tone)
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-medium">
                        {item.title}
                      </strong>
                      <small className="block truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </small>
                    </span>
                    <span className="text-xs text-muted-foreground">{item.timing}</span>
                    <span className="text-right text-sm font-semibold">
                      {item.amount === null ? "Action" : formatCurrency(item.amount)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-border/70 bg-card p-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Selected
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[0.68rem] font-medium",
                    getToneClasses(selected.tone)
                  )}
                >
                  {selected.timing}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em]">
                {selected.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{selected.subtitle}</p>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">{selected.note}</p>
              <div className="mt-5 rounded-lg bg-muted/45 p-3">
                <p className="text-xs text-muted-foreground">Financial exposure</p>
                <p className="mt-1 text-xl font-semibold">
                  {selected.amount === null
                    ? "Calculated during review"
                    : formatCurrency(selected.amount)}
                </p>
              </div>
              <Link
                href={selected.href}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-transform duration-150 ease-[var(--ease-out-ui)] active:scale-[0.98]"
              >
                Open item
                <ArrowRight className="size-4" />
              </Link>
            </>
          ) : (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <CheckCircle2 className="mx-auto size-5 text-success" />
                <h2 className="mt-2 text-sm font-medium">Queue clear</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose another filter or continue with quick actions.
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div>
          <div className="mb-3">
            <h2 className="font-semibold tracking-[-0.02em]">Quick actions</h2>
            <p className="text-xs text-muted-foreground">Start frequent workflows directly.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Quick reading",
                detail: "Water + electric together",
                icon: Droplets,
                href: "/utilities/readings/new",
              },
              {
                title: "Create monthly COSA",
                detail: "Use shared-charge templates",
                icon: Zap,
                href: "/billing/cosa/templates",
              },
              {
                title: "Add adjustment",
                detail: "During invoice generation",
                icon: Plus,
                href: "/billing/generate",
              },
            ].map(({ title, detail, icon: Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left transition-[transform,border-color] duration-150 ease-[var(--ease-out-ui)] hover:border-primary/30 active:scale-[0.98]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-medium">{title}</strong>
                  <small className="block text-xs text-muted-foreground">{detail}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3">
            <h2 className="font-semibold tracking-[-0.02em]">Today&apos;s signals</h2>
            <p className="text-xs text-muted-foreground">Live operational counts.</p>
          </div>
          <div className="grid gap-2">
            {data.reminders.items.map((item) => {
              const href = item.label.toLowerCase().includes("expiring")
                ? "/contracts"
                : "/billing";

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring",
                    getReminderTone(item.tone)
                  )}
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-xs font-medium">
                      {item.label}
                    </strong>
                    <small className="block truncate text-[0.68rem] text-muted-foreground">
                      {item.detail}
                    </small>
                  </span>
                  <span className="flex items-center gap-2">
                    <strong className="text-lg tracking-[-0.04em]">
                      {item.value}
                    </strong>
                    <ArrowRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
