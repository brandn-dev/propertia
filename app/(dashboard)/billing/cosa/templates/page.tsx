import Link from "next/link";
import {
  CopyPlus,
  Droplets,
  Eye,
  Fuel,
  Gauge,
  Layers3,
  Plus,
  Share2,
  Shield,
  Users2,
  Wrench,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { getCosaTemplatesOverview } from "@/lib/data/billing";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { formatCurrency, toNumber } from "@/lib/format";
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

function getAllocationLabel(allocation: {
  helperLabel: string | null;
  contract: {
    tenant: {
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
    };
  } | null;
}) {
  return allocation.contract
    ? formatTenantName(allocation.contract.tenant)
    : allocation.helperLabel || "Ghost helper";
}

const PRESET_ICONS = {
  "common-water": Droplets,
  "common-electricity": Gauge,
  "security-guard": Shield,
  "maintenance-staff": Wrench,
  "generator-fuel": Fuel,
} as const;

export default async function BillingCosaTemplatesPage() {
  await requireCapability("MANAGE_COSA");
  const templates = await getCosaTemplatesOverview();
  const activeTemplates = templates.filter((template) => template.isActive).length;
  const configuredTemplates = templates.filter(
    (template) =>
      template.defaultAmount ||
      template.dailyRate ||
      (template.calculationMode === "METER_READING" && template.meter)
  ).length;
  const participantCount = templates.reduce(
    (sum, template) => sum + template.allocations.length,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing / COSA"
        title="COSA templates"
        description="Store reusable tenant splits for common-area charges like shared water, shared electricity, security guard salary, maintenance staff, or generator fuel. Each month can start from one of these defaults instead of rebuilding the split."
        icon={Layers3}
        badges={["Reusable defaults", "Template-based", "Admin only"]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href="/billing/cosa" />}
              variant="outline"
              className="button-blank rounded-lg"
            >
              <Share2 />
              COSA records
            </Button>
            <Button
              render={<Link href="/billing/cosa/templates/new" />}
              className="rounded-lg"
            >
              <Plus />
              New template
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible templates"
          value={String(templates.length)}
          detail="Reusable COSA split definitions currently available."
          icon={Layers3}
        />
        <DashboardMetricCard
          label="Active templates"
          value={String(activeTemplates)}
          detail="Templates currently available when creating monthly COSA entries."
          icon={Share2}
        />
        <DashboardMetricCard
          label="Configured sources"
          value={String(configuredTemplates)}
          detail="Templates linked to meter, daily rate, or default total."
          icon={CopyPlus}
        />
        <DashboardMetricCard
          label="Template participants"
          value={String(participantCount)}
          detail="Tenant and helper defaults tracked across all templates."
          icon={Users2}
        />
      </section>

      <section className="border-blank rounded-xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Quick-start templates
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start from a proven source type. Salaries use predefined daily
              rates, utilities use exact shared meters, and generator fuel stays
              manual. Participant splits remain editable.
            </p>
          </div>
          <Button
            render={<Link href="/billing/cosa/templates/new" />}
            variant="outline"
            className="button-blank rounded-lg"
          >
            <Plus />
            Blank template
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

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Template table</CardTitle>
              <CardDescription>
                Reusable COSA participant lists and default split values.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/billing/cosa/templates/new" />}
              variant="outline"
              className="button-blank rounded-lg"
            >
              <Plus />
              Add template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <DashboardEmptyState
              icon={Layers3}
              title="No COSA templates yet"
              description="Create the first template here, store the usual tenant split once, then use that template every month when recording shared charges."
              action={
                <Button
                  render={<Link href="/billing/cosa/templates/new" />}
                  className="rounded-lg"
                >
                  <Plus />
                  Create first template
                </Button>
              }
            />
          ) : (
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Split</TableHead>
                  <TableHead>Defaults</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Participants</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const participantLabel = template.allocations
                    .slice(0, 2)
                    .map(getAllocationLabel)
                    .join(", ");

                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {template.name}
                        <p className="text-xs text-muted-foreground">
                          {template.meter
                            ? `${template.meter.utilityType.replaceAll("_", " ")} · ${template.meter.meterCode}`
                            : template.calculationMode === "DAILY_RATE"
                              ? "Daily-rate salary"
                              : "Manual shared charge"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {template.property.name}
                        <p className="text-xs text-muted-foreground">
                          {template.property.propertyCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ALLOCATION_TYPE_LABELS[template.allocationType]}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {participantLabel}
                          {template.allocations.length > 2
                            ? ` +${template.allocations.length - 2} more`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        {template.calculationMode === "DAILY_RATE" && template.dailyRate
                          ? `${formatCurrency(toNumber(template.dailyRate))} / day`
                          : template.defaultAmount
                            ? formatCurrency(toNumber(template.defaultAmount))
                            : template.calculationMode === "METER_READING"
                              ? "From meter reading"
                              : "No default amount"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            template.isActive
                              ? "border-success/25 bg-success/10 text-success-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {template.allocations.length}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            render={<Link href={`/billing/cosa/templates/${template.id}/edit`} />}
                            variant="outline"
                            size="sm"
                            className="button-blank rounded-lg"
                          >
                            <Eye />
                            Edit
                          </Button>
                          <Button
                            render={<Link href={
                              template.calculationMode === "METER_READING"
                                ? `/utilities/readings/new?mode=shared&propertyId=${template.property.id}&templateId=${template.id}`
                                : `/billing/cosa/new?templateId=${template.id}`
                            } />}
                            size="sm"
                            className="rounded-lg"
                          >
                            <CopyPlus />
                            {template.calculationMode === "METER_READING"
                              ? "Record utilities"
                              : template.calculationMode === "DAILY_RATE"
                                ? "Enter days"
                                : "Create monthly"}
                          </Button>
                        </div>
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
