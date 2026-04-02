import {
  CircleDollarSign,
  FileSpreadsheet,
  Plus,
  Repeat2,
} from "lucide-react";
import { createRecurringChargeAction } from "@/app/(dashboard)/billing/actions";
import { RecurringChargeForm } from "@/components/billing/recurring-charge-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import { getRecurringChargeContractOptions } from "@/lib/data/billing";
import { formatDate, toDateInputValue } from "@/lib/format";

type NewBillingChargePageProps = {
  searchParams: Promise<{
    contractId?: string | string[];
  }>;
};

export default async function NewBillingChargePage({
  searchParams,
}: NewBillingChargePageProps) {
  await requireRole("ADMIN");
  const rawSearchParams = await searchParams;
  const selectedContractId =
    typeof rawSearchParams.contractId === "string" ? rawSearchParams.contractId : "";
  const rawContractOptions = await getRecurringChargeContractOptions(
    selectedContractId || undefined
  );
  const contractOptions = rawContractOptions.map((contract) => ({
    id: contract.id,
    status: contract.status,
    paymentStartDate: toDateInputValue(contract.paymentStartDate),
    paymentAnchorLabel: formatDate(contract.paymentStartDate),
    property: contract.property,
    tenant: contract.tenant,
  }));
  const selectedContract = contractOptions.find(
    (contract) => contract.id === selectedContractId
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="New recurring charge"
        description="Create a monthly contract charge that will be included automatically in future invoice cycles while the charge remains active."
        icon={Repeat2}
        badges={["Monthly charge", "Contract-linked", "Admin only"]}
        action={<Plus className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Eligible contracts"
          value={String(contractOptions.length)}
          detail="Draft and active contracts available for recurring charges."
          icon={FileSpreadsheet}
        />
        <DashboardMetricCard
          label="Selected anchor"
          value={selectedContract?.paymentAnchorLabel ?? "None"}
          detail="Recurring charges follow the contract billing start date."
          icon={Repeat2}
        />
        <DashboardMetricCard
          label="Default amount"
          value="PHP 0.00"
          detail="Set the fixed monthly amount that should appear each cycle."
          icon={CircleDollarSign}
        />
      </section>

      <RecurringChargeForm
        mode="create"
        formAction={createRecurringChargeAction}
        contractOptions={contractOptions}
        initialValues={{
          contractId: selectedContractId,
          chargeType: "INTERNET",
          label: "",
          amount: "",
          effectiveStartDate:
            selectedContract?.paymentStartDate ?? toDateInputValue(new Date()),
          effectiveEndDate: "",
          isActive: true,
        }}
      />
    </div>
  );
}
