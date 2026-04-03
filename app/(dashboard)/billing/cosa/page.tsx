import Link from "next/link";
import {
  CircleDollarSign,
  CopyPlus,
  Droplets,
  Eye,
  Plus,
  Rows4,
  Share2,
  Shield,
  Users2,
  Wrench,
  Gauge,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getCosasOverview } from "@/lib/data/billing";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { ALLOCATION_TYPE_LABELS } from "@/lib/form-options";
import { COSA_TEMPLATE_PRESETS } from "@/lib/billing/cosa-presets";
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
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Tenant";
}

const PRESET_ICONS = {
  "common-water": Droplets,
  "common-electricity": Gauge,
  "security-guard": Shield,
  "maintenance-staff": Wrench,
} as const;

export default async function BillingCosaPage() {
  await requireRole("ADMIN");
  const cosas = await getCosasOverview();
  const totalSharedValue = cosas.reduce(
    (sum, cosa) => sum + toNumber(cosa.totalAmount),
    0
  );
  const allocatedContracts = cosas.reduce(
    (sum, cosa) => sum + cosa.allocations.length,
    0
  );
  const billedAllocations = cosas.reduce(
    (sum, cosa) =>
      sum + cosa.allocations.filter((allocation) => allocation.invoiceItem).length,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="COSA allocations"
        description="Create common-area shared charges and split them across chosen tenant contracts. Each saved allocation is picked up by invoice generation once, then linked back to its source."
        icon={Share2}
        badges={["Chosen tenants", "Contract-linked", "Billed once"]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href="/billing/cosa/templates" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <CopyPlus />
              Templates
            </Button>
            <Button render={<Link href="/billing/cosa/new" />} className="rounded-full">
              <Plus />
              New COSA
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible COSA records"
          value={String(cosas.length)}
          detail="Common shared-charge records currently in the registry."
          icon={Rows4}
        />
        <DashboardMetricCard
          label="Allocated contracts"
          value={String(allocatedContracts)}
          detail="Tenant-contract shares currently tracked across all COSA records."
          icon={Users2}
        />
        <DashboardMetricCard
          label="Shared value"
          value={formatCurrency(totalSharedValue)}
          detail="Combined total value of all recorded shared charges."
          icon={CircleDollarSign}
        />
        <DashboardMetricCard
          label="Billed allocations"
          value={String(billedAllocations)}
          detail="Allocations already consumed by invoice generation."
          icon={Eye}
        />
      </section>

      <section className="border-blank rounded-xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Standard COSA starters
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start security guard and maintenance staff as manual monthly salaries
              shared by unit count. Start common water and common electricity as
              shared-meter charges split by percentage.
            </p>
          </div>
          <Button
            render={<Link href="/billing/cosa/templates" />}
            variant="outline"
            className="button-blank rounded-full"
          >
            <CopyPlus />
            Open templates
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>COSA table</CardTitle>
              <CardDescription>
                Shared-charge records, their tenant splits, and whether those allocations have already been billed.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                render={<Link href="/billing/cosa/templates" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <CopyPlus />
                Templates
              </Button>
              <Button
                render={<Link href="/billing/cosa/new" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <Plus />
                Add COSA
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cosas.length === 0 ? (
            <DashboardEmptyState
              icon={Share2}
              title="No COSA records yet"
              description="Create the first shared-charge record here, or start from a reusable template for Common Water, Common Electricity, Security Guard, or Maintenance Staff."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    render={<Link href="/billing/cosa/templates" />}
                    variant="outline"
                    className="button-blank rounded-full"
                  >
                    <CopyPlus />
                    Browse templates
                  </Button>
                  <Button render={<Link href="/billing/cosa/new" />} className="rounded-full">
                    <Plus />
                    Create first COSA
                  </Button>
                </div>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Billing date</TableHead>
                  <TableHead>Split</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Tenants</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cosas.map((cosa) => {
                  const billedCount = cosa.allocations.filter(
                    (allocation) => allocation.invoiceItem
                  ).length;
                  const participantLabel = cosa.allocations
                    .slice(0, 2)
                    .map((allocation) => formatTenantName(allocation.contract.tenant))
                    .join(", ");

                  return (
                    <TableRow key={cosa.id}>
                      <TableCell className="font-medium">
                        {cosa.description}
                        <p className="text-xs text-muted-foreground">
                          {cosa.meter
                            ? `${cosa.meter.utilityType.replaceAll("_", " ")} · ${cosa.meter.meterCode}`
                            : "Manual shared charge"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {cosa.property.name}
                        <p className="text-xs text-muted-foreground">
                          {cosa.property.propertyCode}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(cosa.billingDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ALLOCATION_TYPE_LABELS[cosa.allocationType]}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {participantLabel}
                          {cosa.allocations.length > 2
                            ? ` +${cosa.allocations.length - 2} more`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(toNumber(cosa.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {cosa.allocations.length}
                      </TableCell>
                      <TableCell className="text-right">
                        {billedCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {billedCount > 0 ? (
                          <Badge variant="outline">Locked</Badge>
                        ) : (
                          <Button
                            render={<Link href={`/billing/cosa/${cosa.id}/edit`} />}
                            variant="outline"
                            size="sm"
                            className="button-blank rounded-full"
                          >
                            <Eye />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
