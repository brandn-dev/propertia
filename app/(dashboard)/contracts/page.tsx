import Link from "next/link";
import {
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { getContractsOverview } from "@/lib/data/dashboard";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ContractsWorkspace } from "@/components/contracts/contracts-workspace";

export default async function ContractsPage() {
  await requireCapability("MANAGE_CONTRACTS");
  const contracts = await getContractsOverview();
  const contractRows = contracts.map((contract) => ({
    id: contract.id,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    monthlyRent: toNumber(contract.monthlyRent),
    status: contract.status,
    property: {
      id: contract.property.id,
      name: contract.property.name,
      propertyCode: contract.property.propertyCode,
      parent: contract.property.parent,
    },
    tenant: contract.tenant,
    counts: {
      recurringCharges: contract._count.recurringCharges,
      rentAdjustments: contract._count.rentAdjustments,
    },
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title="Contract pipeline"
        description="Contracts connect tenant identity to the property hierarchy and become the source of rent, recurring charges, invoices, and payment application. This page is the lifecycle view for those agreements."
        icon={FileSpreadsheet}
        badges={["Lease source of truth", "Rent-aware", "Recurring-charge ready"]}
        action={
          <Button render={<Link href="/contracts/new" />} className="rounded-full">
            <Plus />
            New contract
          </Button>
        }
      />

      <ContractsWorkspace contracts={contractRows} />
    </div>
  );
}
