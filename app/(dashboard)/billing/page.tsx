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
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getRecurringChargesOverview } from "@/lib/data/billing";
import { getBillingOverview } from "@/lib/data/dashboard";
import { BillingMonitorWorkspace } from "@/components/billing/billing-monitor-workspace";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { formatCurrency, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BillingPage() {
  await requireRole("ADMIN");
  const [invoices, recurringCharges] = await Promise.all([
    getBillingOverview(),
    getRecurringChargesOverview(),
  ]);
  const clientInvoices = invoices.map((invoice) => ({
    ...invoice,
    totalAmount: toNumber(invoice.totalAmount),
    balanceDue: toNumber(invoice.balanceDue),
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
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Billing monitor"
        description="Invoices are generated from contract billing anchors, recurring charges, COSA allocations, and tenant utility readings. This is the receivables queue for collection follow-up and payment allocation."
        icon={ReceiptText}
        badges={["Cycle-driven", "Recurring-charge aware", "Payment allocation ready"]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href="/billing/backlog" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <ClockArrowDown />
              Backlog
            </Button>
            <Button
              render={<Link href="/billing/cosa" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Share2 />
              COSA
            </Button>
            <Button
              render={<Link href="/billing/charges" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Repeat2 />
              Manage charges
            </Button>
            <Button render={<Link href="/billing/generate" />} className="rounded-full">
              <Plus />
              Generate invoices
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible invoices"
          value={String(clientInvoices.length)}
          detail="Invoices currently surfaced by the billing queue."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Open invoices"
          value={String(openInvoices)}
          detail="Issued, partially paid, or overdue billing records."
          icon={Clock3}
        />
        <DashboardMetricCard
          label="Active recurring"
          value={String(activeRecurringCharges)}
          detail={`${formatCurrency(recurringMonthlyValue)} in scheduled monthly charges.`}
          icon={Repeat2}
        />
        <DashboardMetricCard
          label="Balance due"
          value={formatCurrency(totalReceivables)}
          detail="Current receivables still awaiting collection."
          icon={Scale}
        />
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Invoice table</CardTitle>
              <CardDescription>
                Due dates, tenant assignments, payment counts, and remaining balances in one queue.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                render={<Link href="/billing/backlog" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <ClockArrowDown />
                Backlog
              </Button>
              <Button
                render={<Link href="/billing/cosa" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <Share2 />
                COSA
              </Button>
              <Button
                render={<Link href="/billing/charges" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <Repeat2 />
                Charges
              </Button>
              <Button
                render={<Link href="/billing/generate" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <Plus />
                Generate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientInvoices.length === 0 ? (
            <DashboardEmptyState
              icon={WalletCards}
              title="No invoices yet"
              description="Generate the first billing run from active contracts, recurring charges, COSA allocations, and dedicated tenant meter readings. Once invoices exist, this becomes the daily collections and follow-up view."
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
        </CardContent>
      </Card>
    </div>
  );
}
