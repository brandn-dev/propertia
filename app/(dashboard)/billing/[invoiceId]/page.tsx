import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
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
import { formatDate, toNumber } from "@/lib/format";
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

  const canRecordPayment =
    invoice.status !== "VOID" && toNumber(invoice.balanceDue) > 0;
  const canDeleteInvoice = invoice.payments.length === 0;
  const canEditBacklogInvoice = invoice.origin === "BACKLOG" && canDeleteInvoice;
  const deleteBacklogInvoice = deleteBacklogInvoiceAction.bind(null, invoice.id);
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
              {canDeleteInvoice ? (
                <form action={deleteBacklogInvoice} className="contents">
                  <Button type="submit" variant="destructive" size="icon" className="rounded-full shrink-0">
                    <Trash2 />
                    <span className="sr-only">Delete invoice</span>
                  </Button>
                </form>
              ) : null}
              {canRecordPayment ? (
                <Button
                  render={<Link href={`/billing/${invoice.id}/payment`} />}
                  className="rounded-full"
                >
                  <Plus />
                  Record payment
                </Button>
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
        accessBlock={{
          qrDataUrl,
          publicAccessCode,
        }}
      />
    </div>
  );
}
