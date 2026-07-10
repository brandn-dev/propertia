import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { requireCapability } from "@/lib/auth/user";
import { generateInvoiceQrDataUrl } from "@/lib/billing/invoice-qr";
import { parseInvoicePaperSize } from "@/lib/billing/invoice-pdf-options";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import { ensureInvoicePublicAccessCode } from "@/lib/billing/public-access";
import { getInvoiceForView } from "@/lib/data/billing";

type InvoicePrintPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
  searchParams: Promise<{
    paper?: string | string[];
  }>;
};

export default async function InvoicePrintPage({
  params,
  searchParams,
}: InvoicePrintPageProps) {
  await requireCapability("MANAGE_BILLING");
  const { invoiceId } = await params;
  const query = await searchParams;
  const paperSize = parseInvoicePaperSize(query.paper);
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const model = buildInvoicePresentationModel(invoice);
  const publicAccessCode = await ensureInvoicePublicAccessCode(
    invoice.id,
    invoice.publicAccessCode
  );
  const qrDataUrl = await generateInvoiceQrDataUrl({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    tenantName: model.tenantName,
    propertyName: invoice.contract.property.name,
    billingPeriodStart: invoice.billingPeriodStart,
    billingPeriodEnd: invoice.billingPeriodEnd,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: Number(invoice.totalAmount),
    balanceDue: Number(invoice.balanceDue),
  });

  return (
    <main className="min-h-svh bg-white px-5 py-8 print:p-0">
      <div className="mx-auto max-w-6xl">
        <InvoiceDocument
          model={model}
          renderMode="print"
          paperSize={paperSize}
          layoutMode="paper"
          accessBlock={{
            qrDataUrl,
            publicAccessCode,
          }}
        />
      </div>
    </main>
  );
}
