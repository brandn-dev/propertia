import Link from "next/link";
import { Clock3, History, ReceiptText } from "lucide-react";
import {
  createHistoricalBacklogAction,
  createHistoricalBacklogBulkAction,
} from "@/app/(dashboard)/billing/backlog/actions";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { HistoricalBacklogWorkspace } from "@/components/billing/historical-backlog-workspace";
import { Button } from "@/components/ui/button";
import { getHistoricalBacklogCutoffLabel } from "@/lib/billing/backlog";
import { requireRole } from "@/lib/auth/user";
import { getHistoricalBacklogContractOptions } from "@/lib/data/billing";

export default async function BillingBacklogPage() {
  await requireRole("ADMIN");
  const contractOptions = await getHistoricalBacklogContractOptions();
  const cutoffLabel = getHistoricalBacklogCutoffLabel();
  const eligibleContracts = contractOptions.length;
  const pendingMonths = contractOptions.reduce(
    (sum, contract) => sum + contract.pendingBacklogCycles.length,
    0
  );
  const tenantCount = new Set(contractOptions.map((contract) => contract.tenantId)).size;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Historical backlog"
        description={`Enter manual historical invoices through the transition month starting ${cutoffLabel}. Saved entries become real invoices, optional payments, and linked meter readings when chronology allows it.`}
        icon={History}
        badges={["Admin only", "Manual history", `Cutoff ${cutoffLabel}`]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href="/billing/generate" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <ReceiptText />
              Strict generator
            </Button>
            <Button render={<Link href="/billing" />} className="rounded-full">
              <Clock3 />
              Back to billing
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Historical contracts"
          value={String(eligibleContracts)}
          detail="Contracts that still have missing historical months to encode."
          icon={History}
        />
        <DashboardMetricCard
          label="Historical months"
          value={String(pendingMonths)}
          detail="Missing historical months currently available for manual encoding."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Tenant groups"
          value={String(tenantCount)}
          detail="Distinct tenants with historical transition backlog still open."
          icon={Clock3}
        />
      </section>

      {contractOptions.length === 0 ? (
        <DashboardEmptyState
          icon={History}
          title="No historical backlog remaining"
          description="All visible historical transition months already exist as invoices, so current work can stay inside the strict generator and payment workflow."
          action={
            <Button render={<Link href="/billing/generate" />} className="rounded-full">
              <ReceiptText />
              Open strict generator
            </Button>
          }
        />
      ) : (
        <HistoricalBacklogWorkspace
          singleFormAction={createHistoricalBacklogAction}
          bulkFormAction={createHistoricalBacklogBulkAction}
          contractOptions={contractOptions}
          cutoffLabel={cutoffLabel}
        />
      )}
    </div>
  );
}
