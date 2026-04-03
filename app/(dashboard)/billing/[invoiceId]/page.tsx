import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CircleDollarSign,
  FileText,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { ensureInvoicePublicAccessCode } from "@/lib/billing/public-access";
import { getInvoiceForView } from "@/lib/data/billing";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { InvoiceQrCard } from "@/components/billing/invoice-qr-card";
import { Button } from "@/components/ui/button";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InvoiceDetailPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

const ITEM_TYPE_LABELS = {
  RENT: "Rent",
  RECURRING_CHARGE: "Recurring charge",
  UTILITY_READING: "Utility reading",
  COSA: "COSA",
  ADJUSTMENT: "Adjustment",
  ARREARS: "Arrears",
} as const;

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  await requireRole("ADMIN");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const publicAccessCode = await ensureInvoicePublicAccessCode(
    invoice.id,
    invoice.publicAccessCode
  );

  const itemsWithBalances = invoice.items.map((item: typeof invoice.items[number]) => {
    const allocatedAmount = item.allocations.reduce(
      (sum: number, allocation: typeof item.allocations[number]) => sum + toNumber(allocation.amountAllocated),
      0
    );

    return {
      ...item,
      allocatedAmount,
      remainingAmount: Math.max(0, toNumber(item.amount) - allocatedAmount),
    };
  });

  const collectedAmount = invoice.payments.reduce(
    (sum: number, payment: typeof invoice.payments[number]) => sum + toNumber(payment.amountPaid),
    0
  );
  const canRecordPayment =
    invoice.status !== "VOID" && toNumber(invoice.balanceDue) > 0;
  const itemLookup = new Map<string, typeof itemsWithBalances[number]>(itemsWithBalances.map((item: typeof itemsWithBalances[number]) => [item.id, item]));
  const cycleLabel = formatBillingCycleMonthLabel(invoice.billingPeriodStart);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title={`Invoice for ${cycleLabel}`}
        description={`Review the issued invoice for ${formatTenantName(invoice.tenant)} at ${invoice.contract.property.name}. This is the current rent, recurring-charge, COSA, and utility billing record for the selected cycle.`}
        icon={ReceiptText}
        badges={[
          invoice.invoiceNumber,
          invoice.status.replaceAll("_", " "),
          invoice.contract.property.propertyCode,
          formatDate(invoice.dueDate),
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            {canRecordPayment ? (
              <Button render={<Link href={`/billing/${invoice.id}/payment`} />} className="rounded-full">
                <Plus />
                Record payment
              </Button>
            ) : null}
            <Button render={<Link href="/billing" />} variant="outline" className="button-blank rounded-full">
              Back to billing
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Total amount"
          value={formatCurrency(toNumber(invoice.totalAmount))}
          detail="Gross billed amount for the selected invoice."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Balance due"
          value={formatCurrency(toNumber(invoice.balanceDue))}
          detail="Amount still outstanding against this invoice."
          icon={WalletCards}
        />
        <DashboardMetricCard
          label="Collected"
          value={formatCurrency(collectedAmount)}
          detail={`${invoice.payments.length} payment record(s) applied to this invoice.`}
          icon={FileText}
        />
        <DashboardMetricCard
          label="Due date"
          value={formatDate(invoice.dueDate)}
          detail="Collections follow-up date for this invoice."
          icon={CalendarClock}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader>
              <CardTitle>Invoice items</CardTitle>
              <CardDescription>
              Rent, recurring charges, COSA shares, and utility items captured in this billing run.
              </CardDescription>
            </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsWithBalances.map((item: typeof itemsWithBalances[number]) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {ITEM_TYPE_LABELS[item.itemType as keyof typeof ITEM_TYPE_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right">
                      {toNumber(item.quantity).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(item.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.allocatedAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.remainingAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <InvoiceQrCard
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            publicAccessCode={publicAccessCode}
            tenantName={formatTenantName(invoice.tenant)}
            propertyName={invoice.contract.property.name}
            billingPeriodStart={invoice.billingPeriodStart}
            billingPeriodEnd={invoice.billingPeriodEnd}
            issueDate={invoice.issueDate}
            dueDate={invoice.dueDate}
            totalAmount={toNumber(invoice.totalAmount)}
            balanceDue={toNumber(invoice.balanceDue)}
          />

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Invoice summary</CardTitle>
              <CardDescription>
                Key billing dates, tenant, property, cycle anchor, and totals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">{formatTenantName(invoice.tenant)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium">{invoice.contract.property.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Billing period</span>
                <span className="font-medium">
                  {formatDate(invoice.billingPeriodStart)} to {formatDate(invoice.billingPeriodEnd)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Issue date</span>
                <span className="font-medium">{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Due date</span>
                <span className="font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Billing anchor</span>
                <span className="font-medium">
                  {formatDate(invoice.contract.paymentStartDate)}
                </span>
              </div>
              <div className="h-px bg-border/70" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Rent subtotal</span>
                <span className="font-medium">
                  {formatCurrency(toNumber(invoice.subtotal))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Additional charges</span>
                <span className="font-medium">
                  {formatCurrency(toNumber(invoice.additionalCharges))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">
                  {formatCurrency(toNumber(invoice.discount))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-base">
                <span className="font-medium">Total</span>
                <span className="font-semibold">
                  {formatCurrency(toNumber(invoice.totalAmount))}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Payments are allocated to specific invoice items, so partial rent
                payments and unpaid utilities remain visible separately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    No payments have been recorded yet for this invoice.
                  </p>
                  {canRecordPayment ? (
                    <Button render={<Link href={`/billing/${invoice.id}/payment`} />} className="rounded-full">
                      <Plus />
                      Record first payment
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {invoice.payments.map((payment: typeof invoice.payments[number]) => (
                    <div
                      key={payment.id}
                      className="rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">
                          {formatCurrency(toNumber(payment.amountPaid))}
                        </span>
                        <Badge variant="outline">
                          {payment.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {payment.paymentDate
                          ? `Paid on ${formatDate(payment.paymentDate)}`
                          : `Due ${formatDate(payment.dueDate)}`}
                      </p>
                      {payment.referenceNumber ? (
                        <p className="mt-1 text-muted-foreground">
                          Reference: {payment.referenceNumber}
                        </p>
                      ) : null}
                      {payment.allocations.length > 0 ? (
                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          {payment.allocations.map((allocation: typeof payment.allocations[number]) => {
                            const item = itemLookup.get(allocation.invoiceItemId);

                            return (
                              <p key={`${payment.id}-${allocation.invoiceItemId}`}>
                                {(item?.description ?? "Invoice item").slice(0, 72)}
                                {" · "}
                                {formatCurrency(toNumber(allocation.amountAllocated))}
                              </p>
                            );
                          })}
                        </div>
                      ) : null}
                      {payment.notes ? (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {payment.notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
