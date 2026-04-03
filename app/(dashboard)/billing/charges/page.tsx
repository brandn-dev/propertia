import Link from "next/link";
import {
  CircleDollarSign,
  Eye,
  Plus,
  Repeat2,
  Rows4,
  TimerReset,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import {
  type RecurringChargeOverviewItem,
  getRecurringChargesOverview,
} from "@/lib/data/billing";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { RECURRING_CHARGE_TYPE_LABELS } from "@/lib/form-options";
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

export default async function BillingChargesPage() {
  await requireRole("ADMIN");
  const charges = await getRecurringChargesOverview();
  const activeCharges = charges.filter(
    (charge: RecurringChargeOverviewItem) => charge.isActive
  );
  const monthlyScheduledValue = activeCharges.reduce(
    (sum: number, charge: RecurringChargeOverviewItem) =>
      sum + toNumber(charge.amount),
    0
  );
  const linkedContracts = new Set(
    charges.map((charge: RecurringChargeOverviewItem) => charge.contract.id)
  ).size;
  const invoicedInstances = charges.reduce(
    (sum: number, charge: RecurringChargeOverviewItem) =>
      sum + charge._count.invoiceItems,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Recurring charges"
        description="Manage scheduled monthly charges attached to contracts, such as internet, parking, association dues, and other fixed recurring fees. Active charges flow into each completed billing cycle automatically."
        icon={Repeat2}
        badges={["Contract-linked", "Cycle-aware", "Admin only"]}
        action={
          <Button render={<Link href="/billing/charges/new" />} className="rounded-full">
            <Plus />
            New charge
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible charges"
          value={String(charges.length)}
          detail="Recurring charge records currently in the registry."
          icon={Rows4}
        />
        <DashboardMetricCard
          label="Active charges"
          value={String(activeCharges.length)}
          detail="Charges that will flow into upcoming billing cycles."
          icon={Repeat2}
        />
        <DashboardMetricCard
          label="Monthly scheduled"
          value={formatCurrency(monthlyScheduledValue)}
          detail="Combined monthly recurring value across active charges."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Invoiced instances"
          value={String(invoicedInstances)}
          detail={`${linkedContracts} contract(s) currently carry recurring charges.`}
          icon={Eye}
        />
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Recurring charge table</CardTitle>
              <CardDescription>
                Fixed contract charges that are automatically picked up by invoice generation.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/billing/charges/new" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Plus />
              Add charge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {charges.length === 0 ? (
            <DashboardEmptyState
              icon={TimerReset}
              title="No recurring charges yet"
              description="Add contract-based monthly charges here so invoice generation can include internet, parking, dues, or other fixed fees automatically."
              action={
                <Button render={<Link href="/billing/charges/new" />} className="rounded-full">
                  <Plus />
                  Create first charge
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((charge: RecurringChargeOverviewItem) => (
                  <TableRow key={charge.id}>
                    <TableCell className="font-medium">
                      {charge.label}
                      <p className="text-xs text-muted-foreground">
                        {formatTenantName(charge.contract.tenant)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {charge.contract.property.name}
                      <p className="text-xs text-muted-foreground">
                        {charge.contract.property.propertyCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      {
                        RECURRING_CHARGE_TYPE_LABELS[
                          charge.chargeType as keyof typeof RECURRING_CHARGE_TYPE_LABELS
                        ]
                      }
                    </TableCell>
                    <TableCell>
                      {formatDate(charge.effectiveStartDate)}
                      <p className="text-xs text-muted-foreground">
                        {charge.effectiveEndDate
                          ? `Until ${formatDate(charge.effectiveEndDate)}`
                          : "No end date"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline">
                          {charge.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Contract {charge.contract.status.toLowerCase()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(charge.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {charge._count.invoiceItems}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={<Link href={`/billing/charges/${charge.id}/edit`} />}
                        variant="outline"
                        size="sm"
                        className="button-blank rounded-full"
                      >
                        <Eye />
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
