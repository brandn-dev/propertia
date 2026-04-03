import Link from "next/link";
import { Gauge, PencilLine, Plus, ReceiptText, ScanLine } from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getMeterReadingsOverview } from "@/lib/data/dashboard";
import { formatCompactNumber, formatCurrency, formatDate, toNumber } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/auth/roles";
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

export default async function UtilityReadingsPage() {
  const user = await requireRole(["ADMIN", "METER_READER"]);
  const readings = await getMeterReadingsOverview();
  const totalConsumption = readings.reduce(
    (sum, reading) => sum + toNumber(reading.consumption),
    0
  );
  const totalCharges = readings.reduce(
    (sum, reading) => sum + toNumber(reading.totalAmount),
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Reading log"
        description="This module is the chronological utility feed. Dedicated-meter readings retain the tenant they were recorded for, so each capture stays tied to the right account later."
        icon={ScanLine}
        badges={[ROLE_LABELS[user.role], "Chronological capture", "Tenant-tagged"]}
        action={
          <Button render={<Link href="/utilities/readings/new" />} className="rounded-full">
            <Plus />
            New reading
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Logged readings"
          value={formatCompactNumber(readings.length)}
          detail="Reading records currently visible in the log."
          icon={ScanLine}
        />
        <DashboardMetricCard
          label="Total usage"
          value={formatCompactNumber(totalConsumption)}
          detail="Usage represented by the visible entries."
          icon={Gauge}
        />
        <DashboardMetricCard
          label="Total charges"
          value={formatCurrency(totalCharges)}
          detail="Computed value of the visible utility captures."
          icon={ReceiptText}
        />
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>All readings</CardTitle>
          <CardDescription>
            Latest chronological captures with meter, property, usage, and recorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <DashboardEmptyState
              icon={ScanLine}
              title="No readings yet"
              description="Once the first meter reading is recorded, this log becomes the operational handoff into billing and shared allocation."
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
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading) => (
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
                        formatCompactNumber(toNumber(reading.previousReading))
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUtilityQuantity(
                        reading.meter.utilityType,
                        formatCompactNumber(toNumber(reading.currentReading))
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUtilityQuantity(
                        reading.meter.utilityType,
                        formatCompactNumber(toNumber(reading.consumption))
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(toNumber(reading.totalAmount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {reading.invoiceItem ? (
                        <Badge variant="outline">Billed</Badge>
                      ) : (
                        <Button
                          render={<Link href={`/utilities/readings/${reading.id}/edit`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <PencilLine />
                          Edit
                        </Button>
                      )}
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
