import Link from "next/link";
import {
  Clock3,
  Plus,
  ReceiptText,
  Repeat2,
  Scale,
  Share2,
  ClockArrowDown,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { resolveInvoiceItemDescription } from "@/lib/billing/invoice-presenter";
import { getRecurringChargesOverview } from "@/lib/data/billing";
import { getBillingOverview } from "@/lib/data/dashboard";
import { BillingMonitorWorkspace } from "@/components/billing/billing-monitor-workspace";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { formatCurrency, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-xl font-semibold tracking-[-0.04em]">{value}</span>
      </div>
    </div>
  );
}

export default async function BillingPage() {
  await requireCapability("MANAGE_BILLING");
  const [invoices, recurringCharges] = await Promise.all([
    getBillingOverview(),
    getRecurringChargesOverview(),
  ]);

  const clientInvoices = invoices.map((invoice) => ({
    ...invoice,
    totalAmount: toNumber(invoice.totalAmount),
    balanceDue: toNumber(invoice.balanceDue),
    items: invoice.items.map((item) => ({
      ...item,
      description: resolveInvoiceItemDescription(invoice, item),
      amount: toNumber(item.amount),
      allocations: item.allocations.map((allocation) => ({
        ...allocation,
        amountAllocated: toNumber(allocation.amountAllocated),
      })),
    })),
  }));

  const openInvoices = invoices.filter((invoice) =>
    ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)
  ).length;
  const totalReceivables = invoices.reduce(
    (sum, invoice) => sum + toNumber(invoice.balanceDue),
    0
  );
  const activeRecurringCharges = recurringCharges.filter(
    (charge) => charge.isActive
  ).length;
  const recurringMonthlyValue = recurringCharges
    .filter((charge) => charge.isActive)
    .reduce((sum, charge) => sum + toNumber(charge.amount), 0);

  return (
    <div className="space-y-5 overflow-x-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
          Billing monitor
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/billing/backlog" />}
            variant="outline"
            className="rounded-full"
          >
            <ClockArrowDown />
            Backlog
          </Button>
          <Button
            render={<Link href="/billing/cosa" />}
            variant="outline"
            className="rounded-full"
          >
            <Share2 />
            COSA
          </Button>
          <Button
            render={<Link href="/billing/charges" />}
            variant="outline"
            className="rounded-full"
          >
            <Repeat2 />
            Charges
          </Button>
          <Button render={<Link href="/billing/generate" />} className="rounded-full">
            <Plus />
            Generate
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          label="Invoices"
          value={String(clientInvoices.length)}
          icon={ReceiptText}
        />
        <MetricPill label="Open" value={String(openInvoices)} icon={Clock3} />
        <MetricPill
          label="Recurring"
          value={String(activeRecurringCharges)}
          icon={Repeat2}
        />
        <MetricPill
          label="Balance Due"
          value={formatCurrency(totalReceivables)}
          icon={Scale}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Queue
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full">
              {clientInvoices.length} invoices
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {formatCurrency(recurringMonthlyValue)} recurring
            </Badge>
          </div>
        </div>

        {clientInvoices.length === 0 ? (
          <DashboardEmptyState
            icon={WalletCards}
            title="No invoices yet"
            description="Generate the first billing run."
            action={
              <Button render={<Link href="/billing/generate" />} className="rounded-full">
                <Plus />
                Generate first invoices
              </Button>
            }
          />
        ) : (
          <BillingMonitorWorkspace invoices={clientInvoices} />
        )}
      </section>
    </div>
  );
}
