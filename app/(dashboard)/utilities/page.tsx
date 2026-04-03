import Link from "next/link";
import {
  Gauge,
  PencilLine,
  Plus,
  ReceiptText,
  Rows4,
  Ruler,
  ScanLine,
  Sparkles,
  Split,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getUtilitiesOverview } from "@/lib/data/dashboard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatCompactNumber, formatCurrency, formatDate, toNumber } from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";
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

export default async function UtilitiesPage() {
  const user = await requireRole(["ADMIN", "METER_READER"]);
  const { meters, recentReadings } = await getUtilitiesOverview();
  const sharedMeters = meters.filter((meter) => meter.isShared).length;
  const totalConsumption = recentReadings.reduce(
    (sum, reading) => sum + toNumber(reading.consumption),
    0
  );
  const totalAmount = recentReadings.reduce(
    (sum, reading) => sum + toNumber(reading.totalAmount),
    0
  );

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

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Utility operations"
        description={
          user.role === "ADMIN"
            ? "Track meter infrastructure, review captured readings, and prepare the shared-charge flow into COSA and invoice generation. This is the operational bridge between field readings and billing."
            : "This lane is focused on meter capture. Review the registered meters, confirm the latest readings, and keep the utility feed clean for the billing team."
        }
        icon={Gauge}
        badges={[
          ROLE_LABELS[user.role],
          "Meter-driven billing",
          "Shared charge ready",
        ]}
        action={
          <Button render={<Link href="/utilities/readings/new" />} className="rounded-full">
            <Plus />
            Record reading
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Meters shown"
          value={formatCompactNumber(meters.length)}
          detail="Meter records currently visible in the registry."
          icon={Gauge}
        />
        <DashboardMetricCard
          label="Shared meters"
          value={formatCompactNumber(sharedMeters)}
          detail="Shared utility sources that later need allocation."
          icon={Split}
        />
        <DashboardMetricCard
          label="Recent usage"
          value={formatCompactNumber(totalConsumption)}
          detail="Total captured utility usage in the visible reading queue."
          icon={Ruler}
        />
        <DashboardMetricCard
          label="Recent charges"
          value={formatCurrency(totalAmount)}
          detail="Amount currently represented by the latest readings."
          icon={ReceiptText}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Meter registry</CardTitle>
              <CardDescription>
                Shared and dedicated meters already fit the billing flow from the design document, with dedicated meters now assigned by tenant.
              </CardDescription>
            </div>
            {user.role === "ADMIN" ? (
              <Button
                render={<Link href="/utilities/meters/new" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <Plus />
                New meter
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {meters.length === 0 ? (
              <DashboardEmptyState
                icon={Sparkles}
                title="No utility meters yet"
                description={
                  user.role === "ADMIN"
                    ? "Add meter records first, then the reading capture form can go live and feed the later utility allocation flow."
                    : "No utility meters are registered yet. An administrator needs to create meter records before readings can be captured."
                }
                action={
                  user.role === "ADMIN" ? (
                    <Button
                      render={<Link href="/utilities/meters/new" />}
                      className="rounded-full"
                    >
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

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Recent readings</CardTitle>
              <CardDescription>
                These entries are the handoff point into utilities, COSA, and invoice calculations.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/utilities/readings/new" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Rows4 />
              Add reading
            </Button>
          </CardHeader>
          <CardContent>
            {recentReadings.length === 0 ? (
              <DashboardEmptyState
                icon={ScanLine}
                title="No readings yet"
                description="Once the meter-reader role starts logging data, this queue becomes the live utility feed for validation and billing handoff."
                action={
                  <Button render={<Link href="/utilities/readings/new" />} className="rounded-full">
                    <Plus />
                    Record first reading
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter</TableHead>
                    <TableHead>Tenant / Scope</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Recorder</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReadings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell className="font-medium">
                        {reading.meter.meterCode}
                        <p className="text-xs text-muted-foreground">
                          {reading.meter.property.name}
                        </p>
                      </TableCell>
                      <TableCell>
                        {reading.tenant ? (
                          formatTenantName(reading.tenant)
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Shared / Property-level
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(reading.readingDate)}</TableCell>
                      <TableCell>{reading.recordedBy?.displayName ?? "System"}</TableCell>
                      <TableCell className="text-right">
                        {formatUtilityQuantity(
                          reading.meter.utilityType,
                          formatCompactNumber(toNumber(reading.consumption))
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(toNumber(reading.totalAmount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
