import { notFound } from "next/navigation";
import { Gauge, PencilLine, ReceiptText, Split } from "lucide-react";
import { updateUtilityMeterAction } from "@/app/(dashboard)/utilities/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { UtilityMeterForm } from "@/components/utilities/utility-meter-form";
import {
  getUtilityMeterForEdit,
  getUtilityPropertyOptions,
  getUtilityTenantOptions,
} from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

function formatTenantName(tenant: {
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

type EditUtilityMeterPageProps = {
  params: Promise<{
    meterId: string;
  }>;
};

export default async function EditUtilityMeterPage({
  params,
}: EditUtilityMeterPageProps) {
  await requireRole("ADMIN");
  const { meterId } = await params;
  const meter = await getUtilityMeterForEdit(meterId);

  if (!meter) {
    notFound();
  }

  const [propertyOptions, tenantOptions] = await Promise.all([
    getUtilityPropertyOptions(meter.propertyId),
    getUtilityTenantOptions(meter.tenantId ?? undefined, meter.propertyId),
  ]);
  const action = updateUtilityMeterAction.bind(null, meter.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title={`Edit ${meter.meterCode}`}
        description={`Update the ${meter.utilityType.toLowerCase()} meter assigned to ${meter.property.name}. Historical readings stay intact while the registry record changes.`}
        icon={Gauge}
        badges={[
          meter.property.propertyCode,
          meter.isShared
            ? "Shared"
            : meter.tenant
              ? formatTenantName(meter.tenant)
              : "Dedicated",
          meter.utilityType,
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Recorded readings"
          value={String(meter._count.readings)}
          detail="Chronological captures already stored on this meter."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Shared source"
          value={meter.isShared ? "Yes" : "No"}
          detail="Whether this meter later participates in shared allocation."
          icon={Split}
        />
        <DashboardMetricCard
          label="Linked COSA items"
          value={String(meter._count.cosas)}
          detail="Shared cost entries currently tied to this meter."
          icon={Gauge}
        />
      </section>

      <UtilityMeterForm
        mode="edit"
        formAction={action}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
        initialValues={{
          propertyId: meter.propertyId,
          tenantId: meter.tenantId ?? "",
          utilityType: meter.utilityType,
          meterCode: meter.meterCode,
          isShared: meter.isShared,
        }}
      />
    </div>
  );
}
