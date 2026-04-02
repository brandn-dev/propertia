import { Gauge, Plus, Ruler } from "lucide-react";
import { createMeterReadingAction } from "@/app/(dashboard)/utilities/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { MeterReadingForm } from "@/components/utilities/meter-reading-form";
import { getUtilityMeterReadingOptions } from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

export default async function NewMeterReadingPage() {
  const user = await requireRole(["ADMIN", "METER_READER"]);
  const meterOptions = await getUtilityMeterReadingOptions();
  const assignedTenantCount = new Set(
    meterOptions.flatMap((meter) => (meter.tenant ? [meter.tenant.id] : []))
  ).size;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Record reading"
        description="Choose the tenant first, then capture the next chronological reading for one of that tenant's assigned meters. Shared property meters remain available under their own scope."
        icon={Gauge}
        badges={[user.role, "Tenant-first capture", "Meter-reader enabled"]}
        action={<Plus className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <DashboardMetricCard
          label="Available meters"
          value={String(meterOptions.length)}
          detail="Meters currently ready to receive a new reading."
          icon={Gauge}
        />
        <DashboardMetricCard
          label="Assigned tenants"
          value={String(assignedTenantCount)}
          detail="Tenants that already have at least one registered meter."
          icon={Ruler}
        />
      </section>

      <MeterReadingForm
        formAction={createMeterReadingAction}
        meterOptions={meterOptions}
        role={user.role}
      />
    </div>
  );
}
