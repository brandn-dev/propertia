import Link from "next/link";
import { Clock3, History, ReceiptText } from "lucide-react";
import {
  createHistoricalBacklogAction,
  createHistoricalBacklogBulkAction,
} from "@/app/(dashboard)/billing/backlog/actions";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { HistoricalBacklogWorkspace } from "@/components/billing/historical-backlog-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getHistoricalBacklogCutoffLabel } from "@/lib/billing/backlog";
import { requireCapability } from "@/lib/auth/user";
import { getHistoricalBacklogContractOptions } from "@/lib/data/billing";

export default async function BillingBacklogPage() {
  await requireCapability("MANAGE_BACKLOG");
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
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            Historical backlog
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/billing/generate" />}
            variant="outline"
            size="sm"
            className="rounded-full"
          >
            <ReceiptText />
            Strict generator
          </Button>
          <Button
            render={<Link href="/billing" />}
            size="sm"
            className="rounded-full"
          >
            <Clock3 />
            Back to billing
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <CompactBacklogMetric
          label="Contracts"
          value={String(eligibleContracts)}
          detail="Need historical encoding"
          icon={History}
        />
        <CompactBacklogMetric
          label="Pending months"
          value={String(pendingMonths)}
          detail="Available to encode"
          icon={ReceiptText}
        />
        <CompactBacklogMetric
          label="Tenant groups"
          value={String(tenantCount)}
          detail="Still open"
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

function CompactBacklogMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof History;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1.5">
          <div className="text-[0.72rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {label}
          </div>
          <div className="text-3xl font-semibold tracking-[-0.05em]">{value}</div>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>

        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
