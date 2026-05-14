import { notFound } from "next/navigation";
import { Gauge, Repeat2, Wrench } from "lucide-react";
import { replaceUtilityMeterAction } from "@/app/(dashboard)/utilities/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { UtilityMeterReplacementForm } from "@/components/utilities/utility-meter-replacement-form";
import { requireRole } from "@/lib/auth/user";
import { getUtilityMeterForReplacement } from "@/lib/data/admin";
import { formatDate } from "@/lib/format";

type ReplaceUtilityMeterPageProps = {
  params: Promise<{
    meterId: string;
  }>;
};

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

export default async function ReplaceUtilityMeterPage({
  params,
}: ReplaceUtilityMeterPageProps) {
  await requireRole("ADMIN");
  const { meterId } = await params;
  const meter = await getUtilityMeterForReplacement(meterId);

  if (!meter) {
    notFound();
  }

  const action = replaceUtilityMeterAction.bind(null, meter.id);
  const latestReading = meter.readings[0] ?? null;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title={`Replace ${meter.meterCode}`}
        description={`Retire this ${meter.utilityType.toLowerCase()} meter and register the new physical device as its own record without breaking historical billing.`}
        icon={Wrench}
        badges={[
          meter.property.propertyCode,
          meter.isShared
            ? "Shared"
            : meter.tenant
              ? formatTenantName(meter.tenant)
              : "Dedicated",
          meter.utilityType,
        ]}
        action={<Repeat2 className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Current meter"
          value={meter.meterCode}
          detail="The existing meter record that will be retired."
          icon={Gauge}
        />
        <DashboardMetricCard
          label="Latest reading"
          value={latestReading ? latestReading.currentReading : "No readings"}
          detail={
            latestReading
              ? `Captured on ${formatDate(latestReading.readingDate)}`
              : "This meter has no recorded chronology yet."
          }
          icon={Repeat2}
        />
        <DashboardMetricCard
          label="Current status"
          value={meter.retiredAt ? "Retired" : "Active"}
          detail="Replacement is intended for an active source before new readings continue."
          icon={Wrench}
        />
      </section>

      <UtilityMeterReplacementForm formAction={action} meter={meter} />
    </div>
  );
}
