import { FileSpreadsheet, Plus } from "lucide-react";
import { createContractAction } from "@/app/(dashboard)/contracts/actions";
import { ContractForm } from "@/components/contracts/contract-form";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import {
  getContractPropertyOptions,
  getContractTenantOptions,
} from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

export default async function NewContractPage() {
  await requireRole("ADMIN");
  const [propertyOptions, tenantOptions] = await Promise.all([
    getContractPropertyOptions(),
    getContractTenantOptions(),
  ]);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title="Create contract"
        description="Create an agreement between a leasable property and a tenant with dates, rent terms, and billing start behavior. This is the first real operational step into invoice generation."
        icon={FileSpreadsheet}
        badges={["Lease source of truth", "Billing-ready", "Admin only"]}
        action={<Plus className="size-5 text-primary" />}
      />
      <ContractForm
        mode="create"
        formAction={createContractAction}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
      />
    </div>
  );
}
