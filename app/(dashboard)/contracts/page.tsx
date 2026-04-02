import Link from "next/link";
import {
  CalendarClock,
  CircleDollarSign,
  FileSpreadsheet,
  Handshake,
  PencilLine,
  Plus,
  Repeat2,
  TimerReset,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getContractsOverview } from "@/lib/data/dashboard";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Unassigned";
}

export default async function ContractsPage() {
  await requireRole("ADMIN");
  const contracts = await getContractsOverview();
  const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE").length;
  const totalMonthlyRent = contracts.reduce(
    (sum, contract) => sum + toNumber(contract.monthlyRent),
    0
  );
  const now = new Date();
  const ninetyDaysFromNow = new Date(now);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const expiringSoon = contracts.filter(
    (contract) => contract.endDate >= now && contract.endDate <= ninetyDaysFromNow
  ).length;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Contracts"
        title="Contract pipeline"
        description="Contracts connect tenant identity to the property hierarchy and become the source of rent, recurring charges, invoices, and payment application. This page is the lifecycle view for those agreements."
        icon={FileSpreadsheet}
        badges={["Lease source of truth", "Rent-aware", "Recurring-charge ready"]}
        action={
          <Button render={<Link href="/contracts/new" />} className="rounded-full">
            <Plus />
            New contract
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible contracts"
          value={String(contracts.length)}
          detail="Contracts currently surfaced in this pipeline."
          icon={FileSpreadsheet}
        />
        <DashboardMetricCard
          label="Active now"
          value={String(activeContracts)}
          detail="Agreements currently in force and billable."
          icon={Handshake}
        />
        <DashboardMetricCard
          label="Expiring soon"
          value={String(expiringSoon)}
          detail="Contracts ending within the next ninety days."
          icon={CalendarClock}
        />
        <DashboardMetricCard
          label="Monthly rent"
          value={formatCurrency(totalMonthlyRent)}
          detail="Current rent exposure from visible contracts."
          icon={CircleDollarSign}
        />
      </section>

      <Card className="rounded-[1.85rem] border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Contract table</CardTitle>
              <CardDescription>
                Active and upcoming agreements tied to property and tenant records.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/billing/charges" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Repeat2 />
              Recurring charges
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <DashboardEmptyState
              icon={TimerReset}
              title="No contracts yet"
              description="This workspace is ready for contract creation, rent schedules, recurring charges, and invoice workflows."
              action={
                <Button render={<Link href="/contracts/new" />} className="rounded-full">
                  <Plus />
                  Create first contract
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">Monthly rent</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      {contract.property.name}
                      <p className="text-xs text-muted-foreground">
                        {contract.property.propertyCode}
                      </p>
                    </TableCell>
                    <TableCell>{formatTenantName(contract.tenant)}</TableCell>
                    <TableCell>{formatDate(contract.startDate)}</TableCell>
                    <TableCell>{formatDate(contract.endDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{contract.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {contract._count.recurringCharges}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(contract.monthlyRent))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={<Link href={`/contracts/${contract.id}/edit`} />}
                        variant="outline"
                        size="sm"
                        className="button-blank rounded-full"
                      >
                        <PencilLine />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
