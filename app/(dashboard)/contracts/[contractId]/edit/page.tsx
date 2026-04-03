import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  FileSpreadsheet,
  Repeat2,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import { updateContractAction } from "@/app/(dashboard)/contracts/actions";
import { ContractForm } from "@/components/contracts/contract-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import {
  getContractForEdit,
  getContractPropertyOptions,
  getContractTenantOptions,
} from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";
import { formatCurrency, toDateInputValue, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

type EditContractPageProps = {
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

function deriveMonthsFromAmount(amount: string, monthlyRent: string) {
  const amountValue = Number(amount);
  const monthlyRentValue = Number(monthlyRent);

  if (!amountValue || !monthlyRentValue) {
    return "0";
  }

  const ratio = amountValue / monthlyRentValue;
  const rounded = Math.round(ratio);

  return Math.abs(ratio - rounded) < 0.01 ? String(rounded) : "0";
}

export default async function EditContractPage({
  params,
}: EditContractPageProps) {
  await requireRole("ADMIN");
  const { contractId } = await params;
  const contract = await getContractForEdit(contractId);

  if (!contract) {
    notFound();
  }

  const [propertyOptions, tenantOptions] = await Promise.all([
    getContractPropertyOptions(contract.propertyId),
    getContractTenantOptions(),
  ]);

  const action = updateContractAction.bind(null, contract.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title={`Edit ${contract.property.propertyCode}`}
        description={`Update the agreement between ${contract.property.name} and ${formatTenantLabel(contract.tenant)}. Changes here affect downstream billing, recurring charges, and collection context.`}
        icon={FileSpreadsheet}
        badges={[
          contract.status.replaceAll("_", " "),
          contract.property.propertyCode,
          formatTenantLabel(contract.tenant),
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href={`/contracts/${contract.id}/adjustments`} />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <RotateCcw />
              Rent adjustments
            </Button>
            <Button
              render={<Link href={`/billing/charges/new?contractId=${contract.id}`} />}
              className="rounded-full"
            >
              <Repeat2 />
              Add recurring charge
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Monthly rent"
          value={formatCurrency(toNumber(contract.monthlyRent))}
          detail="Base recurring rent on this agreement."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Issued invoices"
          value={String(contract._count.invoices)}
          detail="Invoices already generated from this contract."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Adjustments"
          value={String(contract._count.rentAdjustments)}
          detail="Scheduled rent changes attached to this agreement."
          icon={RotateCcw}
        />
        <DashboardMetricCard
          label="Recurring charges"
          value={String(contract._count.recurringCharges)}
          detail="Monthly charges such as internet, parking, or dues."
          icon={Repeat2}
        />
      </section>

      <ContractForm
        mode="edit"
        formAction={action}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
        initialValues={{
          propertyId: contract.propertyId,
          tenantId: contract.tenantId,
          startDate: toDateInputValue(contract.startDate),
          endDate: toDateInputValue(contract.endDate),
          paymentStartDate: toDateInputValue(contract.paymentStartDate),
          monthlyRent: contract.monthlyRent.toString(),
          advanceRentMonths:
            contract.advanceRentMonths > 0
              ? String(contract.advanceRentMonths)
              : deriveMonthsFromAmount(
                  contract.advanceRent.toString(),
                  contract.monthlyRent.toString()
                ),
          securityDepositMonths:
            contract.securityDepositMonths > 0
              ? String(contract.securityDepositMonths)
              : deriveMonthsFromAmount(
                  contract.securityDeposit.toString(),
                  contract.monthlyRent.toString()
                ),
          freeRentCycles: String(contract.freeRentCycles),
          advanceRentApplication: contract.advanceRentApplication,
          status: contract.status,
          notes: contract.notes ?? "",
        }}
      />
    </div>
  );
}
