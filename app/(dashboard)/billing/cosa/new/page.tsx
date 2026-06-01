import Link from "next/link";
import {
  CircleDollarSign,
  CopyPlus,
  Droplets,
  Gauge,
  Fuel,
  Share2,
  Shield,
  Users2,
  Wrench,
} from "lucide-react";
import { createCosaAction } from "@/app/(dashboard)/billing/actions";
import { CosaForm } from "@/components/billing/cosa-form";
import { Button } from "@/components/ui/button";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireCapability } from "@/lib/auth/user";
import {
  getCosaContractOptions,
  getCosaPropertyOptions,
  getCosaSharedMeterOptions,
  getCosaTemplateForEdit,
} from "@/lib/data/billing";
import { COSA_TEMPLATE_PRESETS } from "@/lib/billing/cosa-presets";
import { formatDate, toDateInputValue } from "@/lib/format";

const PRESET_ICONS = {
  "common-water": Droplets,
  "common-electricity": Gauge,
  "security-guard": Shield,
  "maintenance-staff": Wrench,
  "generator-fuel": Fuel,
} as const;

type NewBillingCosaPageProps = {
  searchParams: Promise<{
    propertyId?: string | string[];
    templateId?: string | string[];
  }>;
};

export default async function NewBillingCosaPage({
  searchParams,
}: NewBillingCosaPageProps) {
  await requireCapability("MANAGE_COSA");
  const rawSearchParams = await searchParams;
  const requestedPropertyId =
    typeof rawSearchParams.propertyId === "string" ? rawSearchParams.propertyId : "";
  const selectedTemplateId =
    typeof rawSearchParams.templateId === "string" ? rawSearchParams.templateId : "";
  const selectedTemplate = selectedTemplateId
    ? await getCosaTemplateForEdit(selectedTemplateId)
    : null;
  const selectedPropertyId = selectedTemplate?.propertyId ?? requestedPropertyId;
  const meterUtilityTypeFilter = selectedTemplate?.meter?.utilityType ?? null;
  const [propertyOptions, meterOptionsRaw, contractOptionsRaw] = await Promise.all([
    getCosaPropertyOptions(selectedPropertyId || undefined),
    getCosaSharedMeterOptions(
      selectedTemplate?.meterId ?? undefined,
      meterUtilityTypeFilter ?? undefined,
    ),
    getCosaContractOptions(),
  ]);
  const contractOptions = contractOptionsRaw.map((contract) => ({
    id: contract.id,
    status: contract.status,
    paymentStartDate: toDateInputValue(contract.paymentStartDate),
    paymentAnchorLabel: formatDate(contract.paymentStartDate),
    property: {
      ...contract.property,
      size: contract.property.size?.toString() ?? null,
    },
    tenant: contract.tenant,
  }));
  const selectablePropertyCount = propertyOptions.filter((property) =>
    propertyOptions.some(
      (candidate) =>
        candidate.parentPropertyId === property.id && candidate.status !== "ARCHIVED",
    )
  ).length;
  const templateAllocations = selectedTemplate
    ? selectedTemplate.allocations
        .filter(
          (allocation) => {
            const contractId = allocation.contract?.id;

            return (
              !contractId ||
              contractOptions.some((contract) => contract.id === contractId)
            );
          }
        )
        .map((allocation) => ({
          entryId: allocation.contract?.id ?? `helper:${allocation.id}`,
          contractId: allocation.contract?.id ?? "",
          helperLabel: allocation.helperLabel ?? "",
          isHelper: !allocation.contract,
          percentage: allocation.percentage?.toString() ?? "",
          unitCount: allocation.unitCount?.toString() ?? "",
          amount: allocation.amount?.toString() ?? "",
        }))
    : [];

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="New COSA charge"
        description={
          selectedTemplate
            ? `Record a shared common-area charge from the ${selectedTemplate.name} template. Template structure stays locked here so monthly COSA creation does not accidentally change template defaults.`
            : "Record a shared common-area charge, choose which tenant contracts should share it, and let invoice generation carry those computed allocations into the right billing month."
        }
        icon={Share2}
        badges={[
          "Shared charge",
          selectedTemplate ? "Template snapshot" : "Chosen tenants",
          "Admin only",
        ]}
        action={
          <Button
            render={<Link href="/billing/cosa/templates" />}
            variant="outline"
            className="button-blank rounded-full"
          >
            <CopyPlus />
            {selectedTemplate ? "Change template" : "Templates"}
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Eligible properties"
          value={String(selectablePropertyCount)}
          detail="Active properties available for shared-charge allocation."
          icon={Share2}
        />
        <DashboardMetricCard
          label="Shared meters"
          value={String(meterOptionsRaw.length)}
          detail="Optional shared meters that can be linked to COSA records."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label={selectedTemplate ? "Template participants" : "Active contracts"}
          value={String(selectedTemplate ? templateAllocations.length : contractOptions.length)}
          detail={
            selectedTemplate
              ? "Default tenant contracts copied in from the selected template."
              : "Tenant contracts currently eligible for shared-charge participation."
          }
          icon={Users2}
        />
      </section>

      {!selectedTemplate ? (
        <section className="border-blank rounded-xl p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.04em]">
                Start from a standard template
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use these when you want the standard COSA setup you described:
                water and electricity by percentage, security guard and maintenance
                staff by unit count, or generator fuel as a manual shared cost with
                an editable split mode.
              </p>
            </div>
            <Button
              render={<Link href="/billing/cosa/templates" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <CopyPlus />
              Manage templates
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {COSA_TEMPLATE_PRESETS.map((preset) => {
              const Icon = PRESET_ICONS[preset.id];

              return (
                <Button
                  key={preset.id}
                  render={<Link href={`/billing/cosa/templates/new?preset=${preset.id}`} />}
                  variant="outline"
                  className="button-blank h-auto justify-start rounded-xl px-4 py-4 text-left"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {preset.sourceHint}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </section>
      ) : null}

      <CosaForm
        key={selectedTemplate?.id ?? `property:${selectedPropertyId || "none"}`}
        mode="create"
        formAction={createCosaAction}
        propertyOptions={propertyOptions}
        meterOptions={meterOptionsRaw}
        meterUtilityTypeFilter={meterUtilityTypeFilter}
        contractOptions={contractOptions}
        initialValues={{
          propertyId: selectedPropertyId,
          meterId: selectedTemplate?.meterId ?? "",
          meterReadingId: "",
          description: selectedTemplate?.name ?? "",
          totalAmount: selectedTemplate?.defaultAmount?.toString() ?? "",
          billingDate: toDateInputValue(new Date()),
          allocationType: selectedTemplate?.allocationType ?? "EQUAL_SPLIT",
          allocations: templateAllocations,
        }}
        templateLock={
          selectedTemplate
            ? {
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
              }
            : null
        }
      />
    </div>
  );
}
