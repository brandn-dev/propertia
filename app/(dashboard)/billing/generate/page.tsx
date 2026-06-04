import { CalendarRange, ReceiptText } from "lucide-react";
import { generateInvoicesAction } from "@/app/(dashboard)/billing/actions";
import {
  filterCyclesWithoutInvoicedMonths,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleKey,
  getBillingMonthKey,
} from "@/lib/billing/cycles";
import { getHistoricalBacklogCutoffDate } from "@/lib/billing/backlog";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { InvoiceGenerationForm } from "@/components/billing/invoice-generation-form";
import { requireCapability } from "@/lib/auth/user";
import { getInvoiceGenerationContractOptions } from "@/lib/data/billing";
import { formatDate, toDateInputValue } from "@/lib/format";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default async function GenerateBillingPage() {
  await requireCapability("MANAGE_BILLING");
  const rawContractOptions = await getInvoiceGenerationContractOptions();
  const today = new Date();
  const issueDate = addDays(today, 0);
  const cutoffDate = getHistoricalBacklogCutoffDate();
  const contractOptions = rawContractOptions.map((contract) => ({
    id: contract.id,
    tenantId: contract.tenantId,
    monthlyRent: contract.monthlyRent,
    paymentAnchorDate: contract.paymentStartDate.toISOString(),
    contractEndDate: contract.endDate.toISOString(),
    rentAdjustments: contract.rentAdjustments,
    existingPeriods: contract.invoices.map((invoice) => ({
      start: invoice.billingPeriodStart.toISOString(),
      end: invoice.billingPeriodEnd.toISOString(),
    })),
    pendingCycleLabels: filterCyclesWithoutInvoicedMonths(
      findNextCompletedBillingCycles({
        anchorDate: contract.paymentStartDate,
        contractEndDate: contract.endDate,
        issueDate,
        existingPeriods: new Set(
          contract.invoices.map((invoice) =>
            getBillingCycleKey(invoice.billingPeriodStart, invoice.billingPeriodEnd)
          )
        ),
        includeCurrentCycle: true,
        includeNextCycleInIssueMonth: true,
      }),
      new Set(
        contract.invoices.map((invoice) =>
          getBillingMonthKey(invoice.billingPeriodStart)
        )
      )
    )
      .filter((cycle) => cycle.end >= cutoffDate)
      .map((cycle) => formatBillingCycleLabel(cycle)),
    paymentAnchorLabel: formatDate(contract.paymentStartDate),
    recurringChargeCount: contract._count.recurringCharges,
    rentAdjustmentCount: contract._count.rentAdjustments,
    recurringCharges: contract.recurringCharges.map((charge) => ({
      id: charge.id,
      chargeType: charge.chargeType,
      label: charge.label,
      amount: charge.amount,
      effectiveStartDate: charge.effectiveStartDate,
      effectiveEndDate: charge.effectiveEndDate,
    })),
    cosaAllocations: contract.cosaAllocations.map((allocation) => ({
      id: allocation.id,
      percentage: allocation.percentage,
      unitCount: allocation.unitCount,
      computedAmount: allocation.computedAmount,
      cosa: allocation.cosa,
    })),
    deferredBalances: contract.deferredBalances.map((balance) => ({
      id: balance.id,
      sourceDescription: balance.sourceDescription,
      sourceItemType: balance.sourceItemType,
      deferredAmount: balance.deferredAmount,
      sourceInvoiceNumber: balance.sourceInvoiceNumber,
      sourceBillingPeriodStart: balance.sourceBillingPeriodStart,
      sourceBillingPeriodEnd: balance.sourceBillingPeriodEnd,
    })),
    property: contract.property,
    tenant: contract.tenant,
    readings: contract.readings.map((reading) => ({
      id: reading.id,
      readingDate: reading.readingDate.toISOString(),
      consumption: reading.consumption.toString(),
      ratePerUnit: reading.ratePerUnit.toString(),
      totalAmount: reading.totalAmount.toString(),
      meter: reading.meter,
    })),
  }));
  const eligibleContracts = contractOptions.filter(
    (contract) => contract.pendingCycleLabels.length > 0
  ).length;
  const pendingCycles = contractOptions.reduce(
    (sum, contract) => sum + contract.pendingCycleLabels.length,
    0
  );
  const recurringReadyContracts = contractOptions.filter(
    (contract) => contract.recurringChargeCount > 0
  ).length;
  const earliestAnchor = contractOptions[0]?.paymentAnchorLabel ?? "Not set";

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Generate invoices"
        description="Issue invoices from contract billing cycles anchored on each payment start date. You can bill completed cycles and the current active cycle, then choose which connected-meter utility readings should attach to each invoice."
        icon={ReceiptText}
        badges={["Cycle-based", "Recurring-charge aware", "Admin only"]}
        action={<ReceiptText className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <DashboardMetricCard
          label="Eligible contracts"
          value={String(eligibleContracts)}
          detail={`${pendingCycles} uninvoiced billing month(s) currently visible.`}
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
          tenantId: "",
          issueDate: toDateInputValue(today),
          dueDate: toDateInputValue(addDays(today, 7)),
        }}
      />
    </div>
  );
}
