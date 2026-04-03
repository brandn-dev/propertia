import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Gauge, PencilLine, Rows4 } from "lucide-react";
import { updateMeterReadingAction } from "@/app/(dashboard)/utilities/actions";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { MeterReadingForm } from "@/components/utilities/meter-reading-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/user";
import { getMeterReadingForEdit } from "@/lib/data/admin";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";

type EditMeterReadingPageProps = {
  params: Promise<{
    readingId: string;
  }>;
};

export default async function EditMeterReadingPage({
  params,
}: EditMeterReadingPageProps) {
  const user = await requireRole(["ADMIN", "METER_READER"]);
  const { readingId } = await params;
  const reading = await getMeterReadingForEdit(readingId);

  if (!reading) {
    notFound();
  }

  const action = updateMeterReadingAction.bind(null, reading.id);

  if (!reading.canEdit) {
    return (
      <div className="space-y-6">
        <DashboardPageHero
          eyebrow="Operations / Utilities"
          title="Reading locked"
          description="This reading can no longer be edited because it has already been billed or a later billed reading depends on it."
          icon={AlertTriangle}
          action={<AlertTriangle className="size-5 text-primary" />}
        />

        <Card className="rounded-xl border-border/60 bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Why this is locked</CardTitle>
            <CardDescription>
              Utility reading edits are only allowed while the billing chain is still unbilled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Meter: {reading.meter.meterCode} · {reading.meter.property.name}
            </p>
            <p className="text-muted-foreground">
              Reading date: {formatDate(reading.readingDate)}
            </p>
            <div className="flex gap-2">
              <Button
                render={<Link href="/utilities/readings" />}
                variant="outline"
                className="button-blank rounded-full"
              >
                <Rows4 />
                Back to readings
              </Button>
              {reading.invoiceItem ? (
                <Button
                  render={<Link href={`/billing/${reading.invoiceItem.invoice.id}`} />}
                  className="rounded-full"
                >
                  <Gauge />
                  Open invoice
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Utilities"
        title="Edit reading"
        description="Correct a utility reading before it is billed. The system recalculates previous reading, usage, charge, and any later unbilled readings on the same meter."
        icon={PencilLine}
        badges={["Unbilled only", "Chronology-safe", "Meter-reader enabled"]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Reading date"
          value={formatDate(reading.readingDate)}
          detail="The date can be corrected as long as chronology stays valid."
          icon={PencilLine}
        />
        <DashboardMetricCard
          label="Current value"
          value={formatUtilityQuantity(
            reading.meter.utilityType,
            toNumber(reading.currentReading).toFixed(2)
          )}
          detail="Current captured value before this correction."
          icon={Gauge}
        />
        <DashboardMetricCard
          label="Current charge"
          value={formatCurrency(toNumber(reading.totalAmount))}
          detail="This amount will be recalculated when you save."
          icon={Rows4}
        />
      </section>

      <MeterReadingForm
        mode="edit"
        formAction={action}
        meterOptions={[reading.meterOption]}
        role={user.role}
        initialValues={{
          readingId: reading.id,
          meterId: reading.meterId,
          readingDate: reading.readingDate.toISOString().slice(0, 10),
          currentReading: reading.currentReading.toString(),
          ratePerUnit: reading.ratePerUnit.toString(),
        }}
      />
    </div>
  );
}
