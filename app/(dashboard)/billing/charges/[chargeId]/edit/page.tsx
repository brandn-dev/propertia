import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  Eye,
  PencilLine,
  Repeat2,
} from "lucide-react";
import { updateRecurringChargeAction } from "@/app/(dashboard)/billing/actions";
import { RecurringChargeForm } from "@/components/billing/recurring-charge-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import {
  getRecurringChargeContractOptions,
  getRecurringChargeForEdit,
} from "@/lib/data/billing";
import { formatCurrency, formatDate, toDateInputValue, toNumber } from "@/lib/format";
import { RECURRING_CHARGE_TYPE_LABELS } from "@/lib/form-options";

type EditBillingChargePageProps = {
  params: Promise<{
    chargeId: string;
  }>;
};

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Unassigned";
}

export default async function EditBillingChargePage({
  params,
}: EditBillingChargePageProps) {
  await requireRole("ADMIN");
  const { chargeId } = await params;
  const charge = await getRecurringChargeForEdit(chargeId);

  if (!charge) {
    notFound();
  }

  const rawContractOptions = await getRecurringChargeContractOptions(charge.contractId);
  const contractOptions = rawContractOptions.map((contract) => ({
    id: contract.id,
    status: contract.status,
    paymentStartDate: toDateInputValue(contract.paymentStartDate),
    paymentAnchorLabel: formatDate(contract.paymentStartDate),
    property: contract.property,
    tenant: contract.tenant,
  }));
  const action = updateRecurringChargeAction.bind(null, charge.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title={`Edit ${charge.label}`}
        description={`Update this recurring ${RECURRING_CHARGE_TYPE_LABELS[charge.chargeType].toLowerCase()} charge for ${formatTenantName(charge.contract.tenant)} at ${charge.contract.property.name}. Previously generated invoice items remain intact.`}
        icon={Repeat2}
        badges={[
          charge.isActive ? "Active" : "Inactive",
          charge.contract.property.propertyCode,
          RECURRING_CHARGE_TYPE_LABELS[charge.chargeType],
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Recurring amount"
          value={formatCurrency(toNumber(charge.amount))}
          detail="Fixed monthly amount attached to this contract."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Billing anchor"
          value={formatDate(charge.contract.paymentStartDate)}
          detail="Contract billing start used for invoice cycle timing."
          icon={Repeat2}
        />
        <DashboardMetricCard
          label="Invoice uses"
          value={String(charge._count.invoiceItems)}
          detail="Generated invoice items already linked to this recurring charge."
          icon={Eye}
        />
      </section>

      <RecurringChargeForm
        mode="edit"
        formAction={action}
        contractOptions={contractOptions}
        initialValues={{
          contractId: charge.contractId,
          chargeType: charge.chargeType,
          label: charge.label,
          amount: charge.amount.toString(),
          effectiveStartDate: toDateInputValue(charge.effectiveStartDate),
          effectiveEndDate: toDateInputValue(charge.effectiveEndDate),
          isActive: charge.isActive,
        }}
      />
    </div>
  );
}
