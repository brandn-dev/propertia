import { Gauge, Plus, Ruler } from "lucide-react";
import { createBulkMeterReadingsAction } from "@/app/(dashboard)/utilities/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { BulkMeterReadingForm } from "@/components/utilities/bulk-meter-reading-form";
import { getUtilityMeterReadingOptions } from "@/lib/data/admin";
import { getCosaTemplatesOverview } from "@/lib/data/billing";
import { requireAnyCapability } from "@/lib/auth/user";
import { hasAnyCapability } from "@/lib/auth/roles";

type NewMeterReadingPageProps = {
  searchParams: Promise<{
    mode?: string;
    propertyId?: string;
    templateId?: string;
  }>;
};

export default async function NewMeterReadingPage({ searchParams }: NewMeterReadingPageProps) {
  const user = await requireAnyCapability([
    "MANAGE_UTILITIES",
    "RECORD_READINGS",
  ]);
  const canManageCosa = hasAnyCapability(user, ["MANAGE_COSA"]);
  const [meterOptions, cosaTemplates] = await Promise.all([
    getUtilityMeterReadingOptions(),
    canManageCosa ? getCosaTemplatesOverview() : Promise.resolve([]),
  ]);
  const query = await searchParams;
  const assignedTenantCount = new Set(
    meterOptions.flatMap((meter) => (meter.tenant ? [meter.tenant.id] : []))
  ).size;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Quick utility readings"
        description="Choose one tenant or shared property, then capture water and electricity together in one atomic save."
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

      <BulkMeterReadingForm
        formAction={createBulkMeterReadingsAction}
        meterOptions={meterOptions}
        cosaTemplates={cosaTemplates.map((template) => ({
          ...template,
          defaultAmount: template.defaultAmount?.toString() ?? null,
          dailyRate: template.dailyRate?.toString() ?? null,
          allocations: template.allocations.map((allocation) => ({
            ...allocation,
            percentage: allocation.percentage?.toString() ?? null,
            amount: allocation.amount?.toString() ?? null,
            contract: allocation.contract
              ? {
                  ...allocation.contract,
                  property: {
                    ...allocation.contract.property,
                    size: allocation.contract.property.size?.toString() ?? null,
                  },
                }
              : null,
          })),
        }))}
        role={user.role}
        initialMode={query.mode === "shared" ? "shared" : "tenant"}
        initialPropertyId={query.propertyId ?? ""}
        initialTemplateId={query.templateId ?? ""}
      />
    </div>
  );
}
