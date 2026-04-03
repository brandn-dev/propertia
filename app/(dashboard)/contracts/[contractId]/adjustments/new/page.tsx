import { notFound } from "next/navigation";
import { CircleDollarSign, Plus, RotateCcw } from "lucide-react";
import { createRentAdjustmentAction } from "@/app/(dashboard)/contracts/actions";
import { RentAdjustmentForm } from "@/components/contracts/rent-adjustment-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import { getContractRentAdjustmentOverview } from "@/lib/data/admin";
import { formatCurrency, formatDate, toDateInputValue, toNumber } from "@/lib/format";

type NewContractAdjustmentPageProps = {
  params: Promise<{
    contractId: string;
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

export default async function NewContractAdjustmentPage({
  params,
}: NewContractAdjustmentPageProps) {
  await requireRole("ADMIN");
  const { contractId } = await params;
  const contract = await getContractRentAdjustmentOverview(contractId);

  if (!contract) {
    notFound();
  }

  const action = createRentAdjustmentAction.bind(null, contract.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title="New rent adjustment"
        description={`Schedule a rent change for ${formatTenantLabel(contract.tenant)} at ${contract.property.name}. Use this when the contract needs a raised rent after a fixed milestone such as year two.`}
        icon={RotateCcw}
        badges={[
          contract.property.propertyCode,
          contract.status.replaceAll("_", " "),
          formatTenantLabel(contract.tenant),
        ]}
        action={<Plus className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Base rent"
          value={formatCurrency(toNumber(contract.monthlyRent))}
          detail="Original monthly rent stored on the contract."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Contract term"
          value={formatDate(contract.startDate)}
          detail={`Ends ${formatDate(contract.endDate)}. The effective date must stay inside this term.`}
          icon={RotateCcw}
        />
        <DashboardMetricCard
          label="Existing adjustments"
          value={String(contract._count.rentAdjustments)}
          detail="Scheduled rent changes already attached to this contract."
          icon={RotateCcw}
        />
      </section>

      <RentAdjustmentForm
        mode="create"
        contractId={contract.id}
        formAction={action}
        initialValues={{
          effectiveDate: toDateInputValue(contract.paymentStartDate),
          increaseType: "PERCENTAGE",
          increaseValue: "",
          calculationType: "COMPOUND",
          basedOn: "PREVIOUS_RENT",
          notes: "",
        }}
      />
    </div>
  );
}
