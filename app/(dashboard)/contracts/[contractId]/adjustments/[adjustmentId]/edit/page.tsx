import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import { updateRentAdjustmentAction } from "@/app/(dashboard)/contracts/actions";
import { RentAdjustmentForm } from "@/components/contracts/rent-adjustment-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import { getRentAdjustmentForEdit } from "@/lib/data/admin";
import { formatCurrency, formatDate, toDateInputValue, toNumber } from "@/lib/format";
import {
  INCREASE_TYPE_LABELS,
  RENT_CALCULATION_TYPE_LABELS,
} from "@/lib/form-options";

type EditContractAdjustmentPageProps = {
  params: Promise<{
    contractId: string;
    adjustmentId: string;
  }>;
};

function formatTenantLabel(tenant: {
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

export default async function EditContractAdjustmentPage({
  params,
}: EditContractAdjustmentPageProps) {
  await requireRole("ADMIN");
  const { contractId, adjustmentId } = await params;
  const adjustment = await getRentAdjustmentForEdit(contractId, adjustmentId);

  if (!adjustment) {
    notFound();
  }

  const action = updateRentAdjustmentAction.bind(
    null,
    adjustment.contractId,
    adjustment.id
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title="Edit rent adjustment"
        description={`Update the scheduled rent change for ${formatTenantLabel(adjustment.contract.tenant)} at ${adjustment.contract.property.name}. Future invoice runs will use the revised rule once the effective date is reached.`}
        icon={RotateCcw}
        badges={[
          adjustment.contract.property.propertyCode,
          INCREASE_TYPE_LABELS[adjustment.increaseType],
          RENT_CALCULATION_TYPE_LABELS[adjustment.calculationType],
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Base rent"
          value={formatCurrency(toNumber(adjustment.contract.monthlyRent))}
          detail="Original monthly rent stored on the parent contract."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Effective date"
          value={formatDate(adjustment.effectiveDate)}
          detail="This rule starts applying from cycles that begin on or after this date."
          icon={RotateCcw}
        />
        <DashboardMetricCard
          label="Increase value"
          value={
            adjustment.increaseType === "PERCENTAGE"
              ? `${toNumber(adjustment.increaseValue).toFixed(2)}%`
              : formatCurrency(toNumber(adjustment.increaseValue))
          }
          detail="Stored change amount for this scheduled increase."
          icon={RotateCcw}
        />
      </section>

      <RentAdjustmentForm
        mode="edit"
        contractId={adjustment.contractId}
        formAction={action}
        initialValues={{
          effectiveDate: toDateInputValue(adjustment.effectiveDate),
          increaseType: adjustment.increaseType,
          increaseValue: adjustment.increaseValue.toString(),
          calculationType: adjustment.calculationType,
          basedOn: adjustment.basedOn,
          notes: adjustment.notes ?? "",
        }}
      />
    </div>
  );
}
