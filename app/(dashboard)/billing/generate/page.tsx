import { CalendarRange, ReceiptText } from "lucide-react";
import { generateInvoicesAction } from "@/app/(dashboard)/billing/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { InvoiceGenerationForm } from "@/components/billing/invoice-generation-form";
import { requireRole } from "@/lib/auth/user";
import { getInvoiceGenerationContractOptions } from "@/lib/data/billing";
import { formatDate, toDateInputValue } from "@/lib/format";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default async function GenerateBillingPage() {
  await requireRole("ADMIN");
  const rawContractOptions = await getInvoiceGenerationContractOptions();
  const today = new Date();
  const contractOptions = rawContractOptions.map((contract) => ({
    id: contract.id,
    paymentAnchorLabel: formatDate(contract.paymentStartDate),
    recurringChargeCount: contract._count.recurringCharges,
    property: contract.property,
    tenant: contract.tenant,
  }));
  const recurringReadyContracts = contractOptions.filter(
    (contract) => contract.recurringChargeCount > 0
  ).length;
  const earliestAnchor = contractOptions[0]?.paymentAnchorLabel ?? "Not set";

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Generate invoices"
        description="Issue invoices from completed billing cycles anchored on each contract's payment start date. This run includes monthly rent, recurring charges, and uninvoiced tenant-dedicated utility readings."
        icon={ReceiptText}
        badges={["Cycle-based", "Recurring-charge aware", "Admin only"]}
        action={<ReceiptText className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <DashboardMetricCard
          label="Active contracts"
          value={String(contractOptions.length)}
          detail="Contracts currently available for invoice generation."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Recurring-ready"
          value={String(recurringReadyContracts)}
          detail={`Earliest billing anchor currently starts ${earliestAnchor}.`}
          icon={CalendarRange}
        />
      </section>

      <InvoiceGenerationForm
        formAction={generateInvoicesAction}
        contractOptions={contractOptions}
        initialValues={{
          contractId: "",
          issueDate: toDateInputValue(today),
          dueDate: toDateInputValue(addDays(today, 7)),
        }}
      />
    </div>
  );
}
