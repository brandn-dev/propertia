import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  Eye,
  Layers3,
  PencilLine,
} from "lucide-react";
import { updateCosaTemplateAction } from "@/app/(dashboard)/billing/actions";
import { CosaTemplateForm } from "@/components/billing/cosa-template-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import {
  getCosaContractOptions,
  getCosaPropertyOptions,
  getCosaSharedMeterOptions,
  getCosaTemplateForEdit,
} from "@/lib/data/billing";
import { formatCurrency, toDateInputValue, toNumber } from "@/lib/format";
import { ALLOCATION_TYPE_LABELS } from "@/lib/form-options";

export default async function EditBillingCosaTemplatePage({
  params,
}: {
  params: Promise<{
    templateId: string;
  }>;
}) {
  await requireRole("ADMIN");
  const { templateId } = await params;
  const template = await getCosaTemplateForEdit(templateId);

  if (!template) {
    notFound();
  }

  const [propertyOptions, meterOptions, contractOptionsRaw] = await Promise.all([
    getCosaPropertyOptions(template.propertyId),
    getCosaSharedMeterOptions(template.meterId ?? undefined),
    getCosaContractOptions(template.allocations.map((allocation) => allocation.contract.id)),
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
  const action = updateCosaTemplateAction.bind(null, template.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing / COSA"
        title={`Edit ${template.name}`}
        description="Update the reusable participant list and split defaults for this shared-charge template. Future monthly COSA records can copy the new defaults immediately."
        icon={Layers3}
        badges={[
          template.isActive ? "Active" : "Inactive",
          template.property.propertyCode,
          ALLOCATION_TYPE_LABELS[template.allocationType],
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Default amount"
          value={
            template.defaultAmount
              ? formatCurrency(toNumber(template.defaultAmount))
              : "Not set"
          }
          detail="Optional amount that can prefill new monthly COSA records."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Selected tenants"
          value={String(template.allocations.length)}
          detail="Tenant contracts currently included in this reusable split."
          icon={Layers3}
        />
        <DashboardMetricCard
          label="Meter linkage"
          value={template.meter ? template.meter.meterCode : "Manual"}
          detail="Template can optionally preload a shared meter when creating the month."
          icon={Eye}
        />
      </section>

      <CosaTemplateForm
        mode="edit"
        formAction={action}
        propertyOptions={propertyOptions}
        meterOptions={meterOptions}
        contractOptions={contractOptions}
        initialValues={{
          propertyId: template.propertyId,
          meterId: template.meterId ?? "",
          name: template.name,
          allocationType: template.allocationType,
          defaultAmount: template.defaultAmount?.toString() ?? "",
          isActive: template.isActive,
          allocations: template.allocations.map((allocation) => ({
            contractId: allocation.contract.id,
            percentage: allocation.percentage?.toString() ?? "",
            unitCount: allocation.unitCount?.toString() ?? "",
            amount: allocation.amount?.toString() ?? "",
          })),
        }}
      />
    </div>
  );
}
