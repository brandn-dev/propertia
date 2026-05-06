import Link from "next/link";
import { Gauge, Plus, ReceiptText, ScanLine } from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getMeterReadingsOverview } from "@/lib/data/dashboard";
import { formatCompactNumber, formatCurrency, toNumber } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ReadingsTableWorkspace } from "@/components/utilities/readings-table-workspace";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UtilityReadingsPage() {
  const user = await requireRole(["ADMIN", "METER_READER"]);
  const readings = await getMeterReadingsOverview();
  const clientReadings = readings.map((reading) => ({
    ...reading,
    readingDate: reading.readingDate.toISOString(),
    previousReading: toNumber(reading.previousReading),
    currentReading: toNumber(reading.currentReading),
    consumption: toNumber(reading.consumption),
    ratePerUnit: toNumber(reading.ratePerUnit),
    totalAmount: toNumber(reading.totalAmount),
  }));
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
          value={formatCompactNumber(clientReadings.length)}
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
          {clientReadings.length === 0 ? (
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
            <ReadingsTableWorkspace readings={clientReadings} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
