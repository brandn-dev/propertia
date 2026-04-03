import Link from "next/link";
import {
  CopyPlus,
  Droplets,
  Eye,
  Gauge,
  Layers3,
  Plus,
  Share2,
  Shield,
  Users2,
  Wrench,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
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

const PRESET_ICONS = {
  "common-water": Droplets,
  "common-electricity": Gauge,
  "security-guard": Shield,
  "maintenance-staff": Wrench,
} as const;

export default async function BillingCosaTemplatesPage() {
  await requireRole("ADMIN");
  const templates = await getCosaTemplatesOverview();
  const activeTemplates = templates.filter((template) => template.isActive).length;
  const defaultedTemplates = templates.filter((template) => template.defaultAmount).length;
  const participantCount = templates.reduce(
    (sum, template) => sum + template.allocations.length,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing / COSA"
        title="COSA templates"
        description="Store reusable tenant splits for common-area charges like shared water, shared electricity, security guard salary, or maintenance staff. Each month can start from one of these defaults instead of rebuilding the split."
        icon={Layers3}
        badges={["Reusable defaults", "Template-based", "Admin only"]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href="/billing/cosa" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Share2 />
              COSA records
            </Button>
            <Button
              render={<Link href="/billing/cosa/templates/new" />}
              className="rounded-full"
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
          label="Templates with default amount"
          value={String(defaultedTemplates)}
          detail="Templates that can prefill a monthly amount immediately."
          icon={CopyPlus}
        />
        <DashboardMetricCard
          label="Template participants"
          value={String(participantCount)}
          detail="Tenant-contract defaults tracked across all templates."
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
              Security guard and maintenance staff are manual monthly salaries
              split by unit count. Water and electricity are shared meters split
              by percentage.
            </p>
          </div>
          <Button
            render={<Link href="/billing/cosa/templates/new" />}
            variant="outline"
            className="button-blank rounded-full"
          >
            <Plus />
            Blank template
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
              <CardTitle>Template table</CardTitle>
              <CardDescription>
                Reusable COSA participant lists and default split values.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/billing/cosa/templates/new" />}
              variant="outline"
              className="button-blank rounded-full"
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
                  className="rounded-full"
                >
                  <Plus />
                  Create first template
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Split</TableHead>
                  <TableHead>Defaults</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tenants</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const participantLabel = template.allocations
                    .slice(0, 2)
                    .map((allocation) => formatTenantName(allocation.contract.tenant))
                    .join(", ");

                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {template.name}
                        <p className="text-xs text-muted-foreground">
                          {template.meter
                            ? `${template.meter.utilityType.replaceAll("_", " ")} · ${template.meter.meterCode}`
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
                        {template.defaultAmount
                          ? formatCurrency(toNumber(template.defaultAmount))
                          : "No default amount"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
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
                            className="button-blank rounded-full"
                          >
                            <Eye />
                            Edit
                          </Button>
                          <Button
                            render={<Link href={`/billing/cosa/new?templateId=${template.id}`} />}
                            size="sm"
                            className="rounded-full"
                          >
                            <CopyPlus />
                            Create monthly
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
