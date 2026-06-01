import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FilePenLine,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { recordPaymentAction } from "@/app/(dashboard)/billing/actions";
import { deleteBacklogInvoiceAction } from "@/app/(dashboard)/billing/[invoiceId]/actions";
import { RecordPaymentSheet } from "@/components/billing/record-payment-sheet";
import { requireCapability } from "@/lib/auth/user";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { InvoicePdfLauncher } from "@/components/billing/invoice-pdf-launcher";
import { generateInvoiceQrDataUrl } from "@/lib/billing/invoice-qr";
import { buildInvoicePresentationModel, formatTenantName } from "@/lib/billing/invoice-presenter";
import { ensureInvoicePublicAccessCode } from "@/lib/billing/public-access";
import { getInvoiceForView } from "@/lib/data/billing";
import { INVOICE_ORIGIN_LABELS } from "@/lib/form-options";
import { formatDate, toDateInputValue, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DashboardPageHero } from "@/components/dashboard/page-hero";

type InvoiceDetailPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  await requireCapability("MANAGE_BILLING");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const canRecordPayment =
    invoice.status !== "VOID" && toNumber(invoice.balanceDue) > 0;
  const canDeleteInvoice = invoice.payments.length === 0;
  const canEditBacklogInvoice = invoice.origin === "BACKLOG" && canDeleteInvoice;
  const canEditGeneratedInvoice = invoice.origin === "GENERATED";
  const deleteBacklogInvoice = deleteBacklogInvoiceAction.bind(null, invoice.id);
  const paymentAction = recordPaymentAction.bind(null, invoice.id);
  const presentationModel = buildInvoicePresentationModel(invoice);
  const descriptionByItemId = new Map(
    presentationModel.items.map((item) => [item.id, item.description])
  );
  let accessBlock:
    | {
        qrDataUrl: string;
        publicAccessCode: string;
      }
    | undefined;

  try {
    const publicAccessCode = await ensureInvoicePublicAccessCode(
      invoice.id,
      invoice.publicAccessCode
    );
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

    accessBlock = {
      qrDataUrl,
      publicAccessCode,
    };
  } catch (error) {
    console.error("Failed to prepare invoice access block", {
      invoiceId: invoice.id,
      error,
    });
  }

  const cycleLabel = presentationModel.title.replace("Invoice for ", "");

  return (
    <div className="space-y-6">
      <DashboardPageHero
        className="rounded-2xl border-border/60 bg-card/70 shadow-sm backdrop-blur"
        contentClassName="p-4 md:p-4.5"
        headerClassName="flex-nowrap items-center"
        actionContainerClassName="max-w-none basis-auto shrink-0"
        titleClassName="text-xl sm:text-2xl"
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
          <div className="flex min-w-0 items-center justify-end">
            <div className="flex shrink-0 items-center justify-center gap-2">
              {canEditBacklogInvoice ? (
                <Button
                  render={<Link href={`/billing/${invoice.id}/edit`} />}
                  variant="outline"
                  size="icon"
                  className="button-blank rounded-full shrink-0"
                >
                  <FilePenLine />
                  <span className="sr-only">Edit backlog invoice</span>
                </Button>
              ) : null}
              {canEditGeneratedInvoice ? (
                <Button
                  render={<Link href={`/billing/${invoice.id}/edit`} />}
                  variant="outline"
                  size="icon"
                  className="button-blank rounded-full shrink-0"
                >
                  <FilePenLine />
                  <span className="sr-only">Edit invoice descriptions</span>
                </Button>
              ) : null}
              {canDeleteInvoice ? (
                <form action={deleteBacklogInvoice} className="contents">
                  <Button type="submit" variant="destructive" size="icon" className="rounded-full shrink-0">
                    <Trash2 />
                    <span className="sr-only">Delete invoice</span>
                  </Button>
                </form>
              ) : null}
              {canRecordPayment ? (
                <RecordPaymentSheet
                  formAction={paymentAction}
                  cycleLabel={cycleLabel}
                  tenantLabel={formatTenantName(invoice.tenant)}
                  propertyLabel={invoice.contract.property.name}
                  invoiceNumber={invoice.invoiceNumber}
                  invoiceBalance={toNumber(invoice.balanceDue)}
                  dueDateLabel={formatDate(invoice.dueDate)}
                  initialValues={{
                    paymentDate: toDateInputValue(new Date()),
                    referenceNumber: "",
                    notes: "",
                  }}
                  items={invoice.items
                    .map((item) => {
                      const allocatedAmount = item.allocations.reduce(
                        (sum, allocation) => sum + toNumber(allocation.amountAllocated),
                        0
                      );
                      const remainingAmount = Math.max(
                        0,
                        toNumber(item.amount) - allocatedAmount
                      );

                      return {
                        id: item.id,
                        itemType: item.itemType,
                        description:
                          descriptionByItemId.get(item.id) ?? item.description,
                        amount: toNumber(item.amount),
                        allocatedAmount,
                        remainingAmount,
                      };
                    })
                    .filter((item) => item.remainingAmount > 0)}
                />
              ) : null}
              <InvoicePdfLauncher
                action={`/billing/${invoice.id}/pdf/file`}
                buttonMode="icon"
                className="w-auto shrink-0"
              />
              <Button
                render={<Link href="/billing" />}
                variant="outline"
                size="icon"
                className="button-blank rounded-full shrink-0"
              >
                <ArrowLeft />
                <span className="sr-only">Back to billing</span>
              </Button>
            </div>
          </div>
        }
      />

      <InvoiceDocument
        model={presentationModel}
        renderMode="internal"
        accessBlock={accessBlock}
      />
    </div>
  );
}
