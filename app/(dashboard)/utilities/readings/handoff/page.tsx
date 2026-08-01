import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import { requireAnyCapability } from "@/lib/auth/user";
import { getSharedReadingHandoff } from "@/lib/data/billing";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";

export default async function ReadingHandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireAnyCapability([
    "MANAGE_UTILITIES",
    "RECORD_READINGS",
    "MANAGE_COSA",
  ]);
  const { ids = "" } = await searchParams;
  const readingIds = ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20);
  const readings = await getSharedReadingHandoff(readingIds);
  const returnTo = encodeURIComponent(
    `/utilities/readings/handoff?ids=${readingIds.join(",")}`
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Utilities / COSA handoff"
        title="Shared readings saved"
        description="Review each saved utility reading, then create its COSA allocation from a matching template."
        icon={Share2}
        badges={[`${readings.length} reading(s)`, "Saved", "Ready for COSA"]}
        action={
          <Button
            render={<Link href="/utilities/readings" />}
            variant="outline"
            className="button-blank rounded-full"
          >
            <ArrowLeft /> Finish
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {readings.map((reading) => (
          <Card key={reading.id} className="rounded-xl border-border/60">
            <CardHeader>
              <CardTitle>
                {UTILITY_TYPE_LABELS[reading.meter.utilityType]} · {reading.meter.meterCode}
              </CardTitle>
              <CardDescription>
                {reading.meter.property.name} · {formatDate(reading.readingDate)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-muted-foreground">Usage</p><p className="font-semibold">{toNumber(reading.consumption)}</p></div>
                <div><p className="text-muted-foreground">Rate</p><p className="font-semibold">{formatCurrency(toNumber(reading.ratePerUnit))}</p></div>
                <div><p className="text-muted-foreground">Total</p><p className="font-semibold">{formatCurrency(toNumber(reading.totalAmount))}</p></div>
              </div>
              {reading.cosa ? (
                <p className="text-sm text-muted-foreground">COSA already created.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {reading.meter.cosaTemplates.map((template) => (
                    <Button
                      key={template.id}
                      render={
                        <Link
                          href={`/billing/cosa/new?templateId=${template.id}&propertyId=${reading.meter.property.id}&meterId=${reading.meter.id}&meterReadingId=${reading.id}&returnTo=${returnTo}`}
                        />
                      }
                      className="rounded-full"
                    >
                      <Share2 /> Create {template.name}
                    </Button>
                  ))}
                  {reading.meter.cosaTemplates.length === 0 ? (
                    <Button
                      render={
                        <Link
                          href={`/billing/cosa/new?propertyId=${reading.meter.property.id}&meterId=${reading.meter.id}&meterReadingId=${reading.id}&returnTo=${returnTo}`}
                        />
                      }
                      variant="outline"
                      className="button-blank rounded-full"
                    >
                      Create COSA manually
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
