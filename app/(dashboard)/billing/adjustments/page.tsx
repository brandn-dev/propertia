import Link from "next/link";
import { ArrowLeft, ListChecks, ReceiptText } from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { getInvoiceAdjustmentsOverview } from "@/lib/data/billing";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function tenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Tenant";
}

export default async function BillingAdjustmentsPage() {
  await requireCapability("MANAGE_BILLING");
  const adjustments = await getInvoiceAdjustmentsOverview();
  const additions = adjustments
    .filter((row) => row.adjustmentType === "ADDITION")
    .reduce((sum, row) => sum + toNumber(row.calculatedAmount), 0);
  const deductions = adjustments
    .filter((row) => row.adjustmentType === "DEDUCTION")
    .reduce((sum, row) => sum + toNumber(row.calculatedAmount), 0);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Invoice adjustments"
        description="Immutable audit trail for additions and deductions applied to invoices."
        icon={ListChecks}
        badges={["Invoice-linked", "Audited", "Immutable"]}
        action={
          <Button render={<Link href="/billing" />} variant="outline" className="button-blank rounded-full">
            <ArrowLeft /> Back to billing
          </Button>
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard label="Adjustment records" value={String(adjustments.length)} detail="All captured invoice adjustment events." icon={ListChecks} />
        <DashboardMetricCard label="Total additions" value={formatCurrency(additions)} detail="Positive invoice adjustment value." icon={ReceiptText} />
        <DashboardMetricCard label="Total deductions" value={formatCurrency(deductions)} detail="Negative invoice adjustment value." icon={ReceiptText} />
      </section>
      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Addition and deduction table</CardTitle>
          <CardDescription>Formula snapshots remain unchanged when later billing settings change.</CardDescription>
        </CardHeader>
        <CardContent>
          {adjustments.length === 0 ? (
            <DashboardEmptyState icon={ListChecks} title="No adjustments yet" description="Additions and deductions created during invoice generation appear here." />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Reason</TableHead><TableHead>Invoice</TableHead><TableHead>Tenant / Property</TableHead><TableHead>Formula</TableHead><TableHead>Source</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {adjustments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.label}<p className="text-xs text-muted-foreground">Target: {row.targetInvoiceItem?.description ?? "Whole invoice"}</p></TableCell>
                    <TableCell><Link className="text-primary hover:underline" href={`/billing/${row.invoice.id}`}>{row.invoice.invoiceNumber}</Link></TableCell>
                    <TableCell>{tenantName(row.invoice.tenant)}<p className="text-xs text-muted-foreground">{row.invoice.contract.property.name} · {row.invoice.contract.property.propertyCode}</p></TableCell>
                    <TableCell>{row.valueType === "PERCENTAGE" ? `${toNumber(row.enteredValue)}%` : formatCurrency(toNumber(row.enteredValue))}</TableCell>
                    <TableCell><Badge variant="outline">{row.source}</Badge><p className="mt-1 text-xs text-muted-foreground">{row.createdBy?.displayName ?? "System / migrated"}</p></TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell className={`text-right font-semibold ${row.adjustmentType === "DEDUCTION" ? "text-destructive" : "text-success"}`}>{row.adjustmentType === "DEDUCTION" ? "−" : "+"}{formatCurrency(toNumber(row.calculatedAmount))}</TableCell>
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
