import Link from "next/link";
import {
  CircleDollarSign,
  Clock3,
  Eye,
  Plus,
  ReceiptText,
  Repeat2,
  Scale,
  WalletCards,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getRecurringChargesOverview } from "@/lib/data/billing";
import { getBillingOverview } from "@/lib/data/dashboard";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function BillingPage() {
  await requireRole("ADMIN");
  const [invoices, recurringCharges] = await Promise.all([
    getBillingOverview(),
    getRecurringChargesOverview(),
  ]);
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
        description="Invoices are generated from contract billing anchors, recurring charges, and tenant utility readings. This is the receivables queue for collection follow-up and payment allocation."
        icon={ReceiptText}
        badges={["Cycle-driven", "Recurring-charge aware", "Payment allocation ready"]}
        action={
          <div className="flex flex-wrap gap-2">
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
          value={String(invoices.length)}
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

      <Card className="rounded-[1.85rem] border-border/70 bg-card/90 shadow-sm">
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
          {invoices.length === 0 ? (
            <DashboardEmptyState
              icon={WalletCards}
              title="No invoices yet"
              description="Generate the first billing run from active contracts, recurring charges, and dedicated tenant meter readings. Once invoices exist, this becomes the daily collections and follow-up view."
              action={
                <Button render={<Link href="/billing/generate" />} className="rounded-full">
                  <Plus />
                  Generate first invoices
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                      <p className="text-xs text-muted-foreground">
                        {invoice._count.items} items
                      </p>
                    </TableCell>
                    <TableCell>
                      {invoice.contract.property.name}
                      <p className="text-xs text-muted-foreground">
                        {invoice.contract.property.propertyCode}
                      </p>
                    </TableCell>
                    <TableCell>{formatTenantName(invoice.tenant)}</TableCell>
                    <TableCell>
                      {formatDate(invoice.billingPeriodStart)}
                      <p className="text-xs text-muted-foreground">
                        to {formatDate(invoice.billingPeriodEnd)}
                      </p>
                    </TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice._count.payments}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(invoice.balanceDue))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          render={<Link href={`/billing/${invoice.id}`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <Eye />
                          View
                        </Button>
                        {toNumber(invoice.balanceDue) > 0 ? (
                          <Button
                            render={<Link href={`/billing/${invoice.id}/payment`} />}
                            size="sm"
                            className="rounded-full"
                          >
                            <CircleDollarSign />
                            Pay
                          </Button>
                        ) : null}
                      </div>
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
