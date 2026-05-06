import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FilePenLine,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { deleteBacklogInvoiceAction } from "@/app/(dashboard)/billing/[invoiceId]/actions";
import { requireRole } from "@/lib/auth/user";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { InvoicePdfLauncher } from "@/components/billing/invoice-pdf-launcher";
import { generateInvoiceQrDataUrl } from "@/lib/billing/invoice-qr";
import { buildInvoicePresentationModel, formatTenantName } from "@/lib/billing/invoice-presenter";
import { ensureInvoicePublicAccessCode } from "@/lib/billing/public-access";
import { getInvoiceForView } from "@/lib/data/billing";
import { INVOICE_ORIGIN_LABELS } from "@/lib/form-options";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { InvoiceQrCard } from "@/components/billing/invoice-qr-card";
import { Button } from "@/components/ui/button";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InvoiceDetailPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  await requireRole("ADMIN");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const publicAccessCode = await ensureInvoicePublicAccessCode(
    invoice.id,
    invoice.publicAccessCode
  );

  const itemsWithBalances = invoice.items.map((item) => {
    const allocatedAmount = item.allocations.reduce(
      (sum, allocation) => sum + toNumber(allocation.amountAllocated),
      0
    );

    return {
      ...item,
      allocatedAmount,
      remainingAmount: Math.max(0, toNumber(item.amount) - allocatedAmount),
    };
  });

  const canRecordPayment =
    invoice.status !== "VOID" && toNumber(invoice.balanceDue) > 0;
  const canDeleteInvoice = invoice.payments.length === 0;
  const canEditBacklogInvoice = invoice.origin === "BACKLOG" && canDeleteInvoice;
  const deleteBacklogInvoice = deleteBacklogInvoiceAction.bind(null, invoice.id);
  const itemLookup = new Map(itemsWithBalances.map((item) => [item.id, item]));
  const presentationModel = buildInvoicePresentationModel(invoice);
  const qrDataUrl = await generateInvoiceQrDataUrl({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    tenantName: formatTenantName(invoice.tenant),
    propertyName: invoice.contract.property.name,
    billingPeriodStart: invoice.billingPeriodStart,
    billingPeriodEnd: invoice.billingPeriodEnd,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: toNumber(invoice.totalAmount),
    balanceDue: toNumber(invoice.balanceDue),
  });
  const cycleLabel = presentationModel.title.replace("Invoice for ", "");
  const showQrCard = false;
  const showPaymentsCard = true;

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title={`Invoice for ${cycleLabel}`}
        icon={ReceiptText}
        badges={[
          invoice.invoiceNumber,
          INVOICE_ORIGIN_LABELS[invoice.origin],
          invoice.status.replaceAll("_", " "),
          invoice.contract.property.propertyCode,
          formatDate(invoice.dueDate),
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            {canEditBacklogInvoice ? (
              <>
                <Button
                  render={<Link href={`/billing/${invoice.id}/edit`} />}
                  variant="outline"
                  className="button-blank rounded-full"
                >
                  <FilePenLine />
                  Edit backlog invoice
                </Button>
              </>
            ) : null}
            {canDeleteInvoice ? (
              <form action={deleteBacklogInvoice}>
                <Button type="submit" variant="destructive" className="rounded-full">
                  <Trash2 />
                  Delete invoice
                </Button>
              </form>
            ) : null}
            {canRecordPayment ? (
              <Button render={<Link href={`/billing/${invoice.id}/payment`} />} className="rounded-full">
                <Plus />
                Record payment
              </Button>
            ) : null}
            <InvoicePdfLauncher action={`/billing/${invoice.id}/pdf/file`} />
            <Button render={<Link href="/billing" />} variant="outline" className="button-blank rounded-full">
              Back to billing
            </Button>
          </div>
        }
      />

      <InvoiceDocument
        model={presentationModel}
        renderMode="internal"
        accessBlock={{
          qrDataUrl,
          publicAccessCode,
        }}
      />

      {showQrCard || showPaymentsCard ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-4">
            {showQrCard ? (
              <InvoiceQrCard
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoiceNumber}
                publicAccessCode={publicAccessCode}
                tenantName={formatTenantName(invoice.tenant)}
                propertyName={invoice.contract.property.name}
                billingPeriodStart={invoice.billingPeriodStart}
                billingPeriodEnd={invoice.billingPeriodEnd}
                issueDate={invoice.issueDate}
                dueDate={invoice.dueDate}
                totalAmount={toNumber(invoice.totalAmount)}
                balanceDue={toNumber(invoice.balanceDue)}
              />
            ) : null}
          </div>

          {showPaymentsCard ? (
            <Card className="rounded-xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Payments are allocated to specific invoice items, so partial rent
                payments and unpaid utilities remain visible separately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    No payments have been recorded yet for this invoice.
                  </p>
                  {canRecordPayment ? (
                    <Button render={<Link href={`/billing/${invoice.id}/payment`} />} className="rounded-full">
                      <Plus />
                      Record first payment
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">
                          {formatCurrency(toNumber(payment.amountPaid))}
                        </span>
                        <Badge variant="outline">
                          {payment.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {payment.paymentDate
                          ? `Paid on ${formatDate(payment.paymentDate)}`
                          : `Due ${formatDate(payment.dueDate)}`}
                      </p>
                      {payment.referenceNumber ? (
                        <p className="mt-1 text-muted-foreground">
                          Reference: {payment.referenceNumber}
                        </p>
                      ) : null}
                      {payment.allocations.length > 0 ? (
                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          {payment.allocations.map((allocation) => {
                            const item = itemLookup.get(allocation.invoiceItemId);

                            return (
                              <p key={`${payment.id}-${allocation.invoiceItemId}`}>
                                {(item?.description ?? "Invoice item").slice(0, 72)}
                                {" · "}
                                {formatCurrency(toNumber(allocation.amountAllocated))}
                              </p>
                            );
                          })}
                        </div>
                      ) : null}
                      {payment.notes ? (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {payment.notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
