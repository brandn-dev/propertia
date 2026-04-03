import {
  CircleDollarSign,
  Droplets,
  Gauge,
  Layers3,
  Shield,
  Wrench,
  Plus,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { createCosaTemplateAction } from "@/app/(dashboard)/billing/actions";
import { CosaTemplateForm } from "@/components/billing/cosa-template-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import {
  getCosaContractOptions,
  getCosaPropertyOptions,
  getCosaSharedMeterOptions,
} from "@/lib/data/billing";
import { COSA_TEMPLATE_PRESETS, getCosaTemplatePreset } from "@/lib/billing/cosa-presets";
import { Button } from "@/components/ui/button";
import { ALLOCATION_TYPE_LABELS } from "@/lib/form-options";
import { toDateInputValue } from "@/lib/format";

const PRESET_ICONS = {
  "common-water": Droplets,
  "common-electricity": Gauge,
  "security-guard": Shield,
  "maintenance-staff": Wrench,
} as const;

export default async function NewBillingCosaTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string | string[];
  }>;
}) {
  await requireRole("ADMIN");
  const rawSearchParams = await searchParams;
  const presetId =
    typeof rawSearchParams.preset === "string" ? rawSearchParams.preset : undefined;
  const selectedPreset = getCosaTemplatePreset(presetId);
  const [propertyOptions, meterOptions, contractOptionsRaw] = await Promise.all([
    getCosaPropertyOptions(),
    getCosaSharedMeterOptions(),
    getCosaContractOptions(),
  ]);
  const contractOptions = contractOptionsRaw.map((contract) => ({
    id: contract.id,
    status: contract.status,
    paymentStartDate: toDateInputValue(contract.paymentStartDate),
    paymentAnchorLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(contract.paymentStartDate),
    property: {
      ...contract.property,
      size: contract.property.size?.toString() ?? null,
    },
    tenant: contract.tenant,
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing / COSA"
        title={selectedPreset ? selectedPreset.label : "New COSA template"}
        description={
          selectedPreset
            ? `${selectedPreset.description} You can still change the property, participants, meter, and split before saving the template.`
            : "Store the usual participants and split logic once, then use that template every month when creating the live COSA record."
        }
        icon={Layers3}
        badges={[
          "Reusable defaults",
          selectedPreset
            ? ALLOCATION_TYPE_LABELS[selectedPreset.allocationType]
            : "Template setup",
          "Admin only",
        ]}
        action={<Plus className="size-5 text-primary" />}
      />

      <section className="border-blank rounded-xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Recommended presets
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These are the four COSA templates you described. Pick one to start with
              the correct split mode already selected.
            </p>
          </div>
          {selectedPreset ? (
            <Button
              render={<Link href="/billing/cosa/templates/new" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              Clear preset
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COSA_TEMPLATE_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.id];
            const isSelected = selectedPreset?.id === preset.id;

            return (
              <Link
                key={preset.id}
                href={`/billing/cosa/templates/new?preset=${preset.id}`}
                className={`border-blank block rounded-xl p-4 transition-colors ${
                  isSelected ? "border-primary/50 bg-primary/5" : "hover:bg-muted/35"
                }`}
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <p className="mt-4 font-medium">{preset.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{preset.sourceHint}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Eligible properties"
          value={String(propertyOptions.length)}
          detail="Properties available for reusable COSA templates."
          icon={Layers3}
        />
        <DashboardMetricCard
          label="Shared meters"
          value={String(meterOptions.length)}
          detail="Optional shared meters that can be pre-linked to a template."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Active contracts"
          value={String(contractOptions.length)}
          detail="Tenant contracts currently eligible for default COSA participation."
          icon={Users2}
        />
      </section>

      <CosaTemplateForm
        mode="create"
        formAction={createCosaTemplateAction}
        propertyOptions={propertyOptions}
        meterOptions={meterOptions}
        contractOptions={contractOptions}
        initialValues={{
          propertyId: "",
          meterId: "",
          name: selectedPreset?.name ?? "",
          allocationType: selectedPreset?.allocationType ?? "PERCENTAGE",
          defaultAmount: "",
          isActive: true,
          allocations: [],
        }}
      />
    </div>
  );
}
