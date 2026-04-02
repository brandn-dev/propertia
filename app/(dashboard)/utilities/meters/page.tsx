import Link from "next/link";
import { Gauge, PencilLine, Plus, Split } from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getUtilityMetersOverview } from "@/lib/data/dashboard";
import { formatCompactNumber } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
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
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export default async function UtilityMetersPage() {
  const user = await requireRole(["ADMIN", "METER_READER"]);
  const meters = await getUtilityMetersOverview();
  const sharedMeters = meters.filter((meter) => meter.isShared).length;
  const totalReadings = meters.reduce((sum, meter) => sum + meter._count.readings, 0);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Meter registry"
        description="The meter registry is the infrastructure layer for utility billing. Shared meters stay at property level, while dedicated meters are assigned directly to tenants on that property."
        icon={Gauge}
        badges={[ROLE_LABELS[user.role], "Registry module", "Tenant-aware"]}
        action={
          user.role === "ADMIN" ? (
            <Button render={<Link href="/utilities/meters/new" />} className="rounded-full">
              <Plus />
              New meter
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Visible meters"
          value={formatCompactNumber(meters.length)}
          detail="Registered utility sources in the current module view."
          icon={Gauge}
        />
        <DashboardMetricCard
          label="Shared meters"
          value={formatCompactNumber(sharedMeters)}
          detail="Meters that later feed shared-charge allocation."
          icon={Split}
        />
        <DashboardMetricCard
          label="Linked readings"
          value={formatCompactNumber(totalReadings)}
          detail="Chronological captures attached across the registry."
          icon={Gauge}
        />
      </section>

      <Card className="rounded-[1.85rem] border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>All meters</CardTitle>
          <CardDescription>
            Property assignments, utility type, shared status, and reading volume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meters.length === 0 ? (
            <DashboardEmptyState
              icon={Gauge}
              title="No utility meters yet"
              description={
                user.role === "ADMIN"
                  ? "Create the first meter to unlock chronological reading capture."
                  : "No utility meters have been registered yet. An administrator needs to add a meter before readings can be recorded."
              }
              action={
                user.role === "ADMIN" ? (
                  <Button render={<Link href="/utilities/meters/new" />} className="rounded-full">
                    <Plus />
                    Create first meter
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meter</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Shared</TableHead>
                  <TableHead className="text-right">Readings</TableHead>
                  {user.role === "ADMIN" ? (
                    <TableHead className="text-right">Action</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((meter) => (
                  <TableRow key={meter.id}>
                    <TableCell className="font-medium">{meter.meterCode}</TableCell>
                    <TableCell>
                      {meter.property.name}
                      <p className="text-xs text-muted-foreground">
                        {meter.property.propertyCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      {meter.tenant ? (
                        <div>
                          <p>{formatTenantName(meter.tenant)}</p>
                          <p className="text-xs text-muted-foreground">Tenant meter</p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Shared / Property-level
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{meter.utilityType.replaceAll("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={meter.isShared ? "secondary" : "outline"}>
                        {meter.isShared ? "Shared" : "Dedicated"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(meter._count.readings)}
                    </TableCell>
                    {user.role === "ADMIN" ? (
                      <TableCell className="text-right">
                        <Button
                          render={<Link href={`/utilities/meters/${meter.id}/edit`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <PencilLine />
                          Edit
                        </Button>
                      </TableCell>
                    ) : null}
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
