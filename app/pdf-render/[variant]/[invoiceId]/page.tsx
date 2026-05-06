import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { generateInvoiceQrDataUrl } from "@/lib/billing/invoice-qr";
import { parseInvoicePaperSize } from "@/lib/billing/invoice-pdf-options";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import {
  type InvoicePdfRenderVariant,
  verifyInvoicePdfRenderToken,
} from "@/lib/billing/invoice-pdf-token";
import { ensureInvoicePublicAccessCode } from "@/lib/billing/public-access";
import { getInvoiceForPublicView, getInvoiceForView } from "@/lib/data/billing";

type InvoicePdfRenderPageProps = {
  params: Promise<{
    variant: InvoicePdfRenderVariant;
    invoiceId: string;
  }>;
  searchParams: Promise<{
    pdf_token?: string | string[];
    paper?: string | string[];
  }>;
};

export default async function InvoicePdfRenderPage({
  params,
  searchParams,
}: InvoicePdfRenderPageProps) {
  const { variant, invoiceId } = await params;
  const query = await searchParams;
  const pdfToken =
    typeof query.pdf_token === "string" ? query.pdf_token : query.pdf_token?.[0];
  const paperSize = parseInvoicePaperSize(query.paper);

  if (
    (variant !== "internal" && variant !== "public") ||
    !verifyInvoicePdfRenderToken({
      token: pdfToken,
      invoiceId,
      variant,
    })
  ) {
    notFound();
  }

  if (variant === "internal") {
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
            renderMode="internal"
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

  const invoice = await getInvoiceForPublicView(invoiceId);

  if (!invoice) {
    notFound();
  }

  return (
    <main className="min-h-svh bg-white px-5 py-8 print:p-0">
      <div className="mx-auto max-w-6xl">
        <InvoiceDocument
          model={buildInvoicePresentationModel(invoice)}
          renderMode="public"
          paperSize={paperSize}
          layoutMode="paper"
        />
      </div>
    </main>
  );
}
