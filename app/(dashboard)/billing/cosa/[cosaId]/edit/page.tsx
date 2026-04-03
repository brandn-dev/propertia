import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  Eye,
  PencilLine,
  Share2,
} from "lucide-react";
import { updateCosaAction } from "@/app/(dashboard)/billing/actions";
import { CosaForm } from "@/components/billing/cosa-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import {
  getCosaContractOptions,
  getCosaForEdit,
  getCosaPropertyOptions,
  getCosaSharedMeterOptions,
} from "@/lib/data/billing";
import { formatCurrency, formatDate, toDateInputValue, toNumber } from "@/lib/format";
import { ALLOCATION_TYPE_LABELS } from "@/lib/form-options";

export default async function EditBillingCosaPage({
  params,
}: {
  params: Promise<{
    cosaId: string;
  }>;
}) {
  await requireRole("ADMIN");
  const { cosaId } = await params;
  const cosa = await getCosaForEdit(cosaId);

  if (!cosa) {
    notFound();
  }

  const billedAllocationCount = cosa.allocations.filter(
    (allocation) => allocation.invoiceItem
  ).length;
  const [propertyOptions, meterOptionsRaw, contractOptionsRaw] = await Promise.all([
    getCosaPropertyOptions(cosa.propertyId),
    getCosaSharedMeterOptions(cosa.meterId ?? undefined),
    getCosaContractOptions(cosa.allocations.map((allocation) => allocation.contract.id)),
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
  const action = updateCosaAction.bind(null, cosa.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title={`Edit ${cosa.description}`}
        description={`Review or update this shared common-area charge for ${cosa.property.name}. Once any allocation has been billed, the record becomes read-only so the posted invoice history stays stable.`}
        icon={Share2}
        badges={[
          ALLOCATION_TYPE_LABELS[cosa.allocationType],
          cosa.property.propertyCode,
          formatDate(cosa.billingDate),
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Shared amount"
          value={formatCurrency(toNumber(cosa.totalAmount))}
          detail="Total common-area value recorded on this COSA entry."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Selected tenants"
          value={String(cosa.allocations.length)}
          detail="Tenant contracts currently participating in this shared charge."
          icon={Share2}
        />
        <DashboardMetricCard
          label="Billed allocations"
          value={String(billedAllocationCount)}
          detail="Once billed, the record is locked from further edits."
          icon={Eye}
        />
      </section>

      <CosaForm
        mode="edit"
        formAction={action}
        propertyOptions={propertyOptions}
        meterOptions={meterOptionsRaw}
        contractOptions={contractOptions}
        initialValues={{
          propertyId: cosa.propertyId,
          meterId: cosa.meterId ?? "",
          meterReadingId: cosa.meterReadingId ?? "",
          description: cosa.description,
          totalAmount: cosa.totalAmount.toString(),
          billingDate: toDateInputValue(cosa.billingDate),
          allocationType: cosa.allocationType,
          allocations: cosa.allocations.map((allocation) => ({
            contractId: allocation.contract.id,
            percentage: allocation.percentage.toString(),
            unitCount: allocation.unitCount?.toString() ?? "",
            amount: allocation.computedAmount.toString(),
          })),
        }}
        lockedReason={
          billedAllocationCount > 0
            ? "This COSA record already has billed allocations and is now read-only."
            : undefined
        }
      />
    </div>
  );
}
