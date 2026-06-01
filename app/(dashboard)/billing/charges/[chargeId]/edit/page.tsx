import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  Eye,
  PencilLine,
  Repeat2,
} from "lucide-react";
import {
  deactivateRecurringChargeAction,
  updateRecurringChargeAction,
} from "@/app/(dashboard)/billing/actions";
import { DeactivateRecurringChargeButton } from "@/components/billing/deactivate-recurring-charge-button";
import { RecurringChargeForm } from "@/components/billing/recurring-charge-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireCapability } from "@/lib/auth/user";
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
  await requireCapability("MANAGE_CHARGES");
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
          descriptionDateDisplayOverride:
            charge.descriptionDateDisplayOverride ?? "",
          effectiveStartDate: toDateInputValue(charge.effectiveStartDate),
          effectiveEndDate: toDateInputValue(charge.effectiveEndDate),
          isActive: charge.isActive,
        }}
      />

      {charge.isActive ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5">
          <p className="text-[0.72rem] uppercase tracking-[0.26em] text-destructive/80">
            Soft delete
          </p>
          <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-foreground">
            Remove this recurring charge
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This sets the charge to inactive only. Existing invoices stay unchanged,
            but future billing cycles will stop including it.
          </p>

          <div className="mt-5">
            <DeactivateRecurringChargeButton
              action={deactivateRecurringChargeAction.bind(null, charge.id)}
              chargeLabel={charge.label}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
