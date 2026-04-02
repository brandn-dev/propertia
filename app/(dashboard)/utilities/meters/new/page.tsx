import { Gauge, Plus } from "lucide-react";
import { createUtilityMeterAction } from "@/app/(dashboard)/utilities/actions";
import { UtilityMeterForm } from "@/components/utilities/utility-meter-form";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import {
  getUtilityPropertyOptions,
  getUtilityTenantOptions,
} from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

export default async function NewUtilityMeterPage() {
  await requireRole("ADMIN");
  const [propertyOptions, tenantOptions] = await Promise.all([
    getUtilityPropertyOptions(),
    getUtilityTenantOptions(),
  ]);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Create meter"
        description="Add a new utility meter to the registry, assign it to a tenant on the property, and keep the reading workflow tenant-first from the start."
        icon={Gauge}
        badges={["Meter registry", "Admin only", "Reading-ready"]}
        action={<Plus className="size-5 text-primary" />}
      />
      <UtilityMeterForm
        mode="create"
        formAction={createUtilityMeterAction}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
      />
    </div>
  );
}
