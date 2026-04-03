import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleDollarSign, PencilLine, RotateCcw } from "lucide-react";
import { saveRentScheduleAction } from "@/app/(dashboard)/contracts/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { RentScheduleForm } from "@/components/contracts/rent-schedule-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/user";
import {
  buildRentScheduleRows,
  calculateAdjustedMonthlyRent,
} from "@/lib/billing/rent-adjustments";
import { formatCurrency, formatDate, toDateInputValue, toNumber } from "@/lib/format";
import { getContractRentAdjustmentOverview } from "@/lib/data/admin";

type ContractAdjustmentsPageProps = {
  params: Promise<{
    contractId: string;
  }>;
};

function formatTenantLabel(tenant: {
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

export default async function ContractAdjustmentsPage({
  params,
}: ContractAdjustmentsPageProps) {
  await requireRole("ADMIN");
  const { contractId } = await params;
  const contract = await getContractRentAdjustmentOverview(contractId);

  if (!contract) {
    notFound();
  }

  const adjustedRent = calculateAdjustedMonthlyRent({
    baseMonthlyRent: contract.monthlyRent,
    cycleStart: new Date(),
    adjustments: contract.rentAdjustments,
  });
  const rentSchedule = buildRentScheduleRows({
    contractStartDate: contract.startDate,
    baseMonthlyRent: contract.monthlyRent,
    adjustments: contract.rentAdjustments,
  });
  const action = saveRentScheduleAction.bind(null, contract.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title={`Rent adjustments · ${contract.property.propertyCode}`}
        description={`Set the rent schedule for ${formatTenantLabel(contract.tenant)} at ${contract.property.name}. The first row is locked to the contract start date, and you can add any number of future effectivity dates.`}
        icon={RotateCcw}
        badges={[
          contract.status.replaceAll("_", " "),
          "Flexible schedule",
          formatTenantLabel(contract.tenant),
        ]}
        action={
          <Button
            render={<Link href={`/contracts/${contract.id}/edit`} />}
            variant="outline"
            className="button-blank rounded-full"
          >
            <PencilLine />
            Back to contract
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Base rent"
          value={formatCurrency(toNumber(contract.monthlyRent))}
          detail="Original monthly rent stored on the contract."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Current adjusted rent"
          value={formatCurrency(adjustedRent)}
          detail="Rent that would apply if billing were generated today."
          icon={RotateCcw}
        />
        <DashboardMetricCard
          label="Scheduled adjustments"
          value={String(contract._count.rentAdjustments)}
          detail="Future or historical rent changes linked to this contract."
          icon={RotateCcw}
        />
        <DashboardMetricCard
          label="Issued invoices"
          value={String(contract._count.invoices)}
          detail="Invoices already produced from this contract."
          icon={CircleDollarSign}
        />
      </section>

      <RentScheduleForm
        formAction={action}
        contractStartDateLabel={formatDate(contract.startDate)}
        initialRows={rentSchedule.map((row) => ({
          kind: row.kind,
          effectiveDate: toDateInputValue(row.effectiveDate),
          ...(row.kind === "BASE"
            ? {
                monthlyRent: row.monthlyRent.toFixed(2),
              }
            : {
                increaseType: row.increaseType,
                increaseValue: row.increaseValue.toFixed(2),
                basedOn: row.basedOn,
              }),
        }))}
      />

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>How this schedule works</CardTitle>
          <CardDescription>
            The contract start date anchors the first row, then future rates use your own effectivity dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The first row becomes the contract&apos;s base monthly rent and starts on{" "}
            {formatDate(contract.startDate)}.
          </p>
          <p>
            Add as many future effectivity dates as needed, even if the gaps are
            irregular like 2 years, then 3 years, then another custom date.
          </p>
          <p>
            Invoice generation uses the latest scheduled rent whose effectivity date
            has already been reached by the billing cycle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
