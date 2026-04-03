import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  ReceiptText,
  Scale,
  WalletCards,
} from "lucide-react";
import { recordPaymentAction } from "@/app/(dashboard)/billing/actions";
import { PaymentForm } from "@/components/billing/payment-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { getInvoiceForView } from "@/lib/data/billing";
import { formatCurrency, formatDate, toDateInputValue, toNumber } from "@/lib/format";

type InvoicePaymentPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Tenant";
}

export default async function InvoicePaymentPage({
  params,
}: InvoicePaymentPageProps) {
  await requireRole("ADMIN");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const payableItems = invoice.items
    .map((item: typeof invoice.items[number]) => {
      const allocatedAmount = item.allocations.reduce(
        (sum: number, allocation: typeof item.allocations[number]) => sum + toNumber(allocation.amountAllocated),
        0
      );
      const remainingAmount = Math.max(0, toNumber(item.amount) - allocatedAmount);

      return {
        id: item.id,
        itemType: item.itemType,
        description: item.description,
        amount: toNumber(item.amount),
        allocatedAmount,
        remainingAmount,
      };
    })
    .filter((item: { remainingAmount: number }) => item.remainingAmount > 0);

  const action = recordPaymentAction.bind(null, invoice.id);
  const cycleLabel = formatBillingCycleMonthLabel(invoice.billingPeriodStart);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title={`Record payment · ${cycleLabel}`}
        description={`Apply a payment for ${formatTenantName(invoice.tenant)} at ${invoice.contract.property.name}. Allocate it by item so rent, recurring fees, COSA, and utility balances stay distinct.`}
        icon={WalletCards}
        badges={[
          invoice.invoiceNumber,
          invoice.status.replaceAll("_", " "),
          invoice.contract.property.propertyCode,
          formatDate(invoice.dueDate),
        ]}
        action={<CircleDollarSign className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Invoice total"
          value={formatCurrency(toNumber(invoice.totalAmount))}
          detail="Original billed amount for this invoice."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Balance due"
          value={formatCurrency(toNumber(invoice.balanceDue))}
          detail="Current outstanding balance before this payment."
          icon={Scale}
        />
        <DashboardMetricCard
          label="Payable items"
          value={String(payableItems.length)}
          detail="Only items with an outstanding balance can receive allocations."
          icon={WalletCards}
        />
        <DashboardMetricCard
          label="Due date"
          value={formatDate(invoice.dueDate)}
          detail="Current collection target date for this invoice."
          icon={CircleDollarSign}
        />
      </section>

      <PaymentForm
        formAction={action}
        invoiceNumber={invoice.invoiceNumber}
        invoiceBalance={toNumber(invoice.balanceDue)}
        dueDateLabel={formatDate(invoice.dueDate)}
        initialValues={{
          paymentDate: toDateInputValue(new Date()),
          referenceNumber: "",
          notes: "",
        }}
        items={payableItems}
      />
    </div>
  );
}
