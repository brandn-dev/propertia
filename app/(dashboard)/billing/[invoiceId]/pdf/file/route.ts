import { requireRole } from "@/lib/auth/user";
import { renderInvoiceBestPdfBuffer, buildInvoicePdfFilename } from "@/lib/billing/invoice-pdf";
import { parseInvoicePaperSize } from "@/lib/billing/invoice-pdf-options";
import { generateInvoiceQrDataUrl } from "@/lib/billing/invoice-qr";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import { ensureInvoicePublicAccessCode } from "@/lib/billing/public-access";
import { getInvoiceForView } from "@/lib/data/billing";

type InvoicePdfFileRouteProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: InvoicePdfFileRouteProps
) {
  await requireRole("ADMIN");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const url = new URL(request.url);
  const shouldDownload = url.searchParams.get("download") === "1";
  const paperSize = parseInvoicePaperSize(url.searchParams.get("paper"));
  const publicAccessCode = await ensureInvoicePublicAccessCode(
    invoice.id,
    invoice.publicAccessCode
  );
  const model = buildInvoicePresentationModel(invoice);
  const qrDataUrl = await generateInvoiceQrDataUrl({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    tenantName:
      invoice.tenant.businessName ||
      [invoice.tenant.firstName, invoice.tenant.lastName].filter(Boolean).join(" ") ||
      "Tenant",
    propertyName: invoice.contract.property.name,
    billingPeriodStart: invoice.billingPeriodStart,
    billingPeriodEnd: invoice.billingPeriodEnd,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: Number(invoice.totalAmount.toString()),
    balanceDue: Number(invoice.balanceDue.toString()),
  });
  const pdfBuffer = await renderInvoiceBestPdfBuffer({
    requestUrl: request.url,
    invoiceId: invoice.id,
    model,
    options: {
      variant: "internal",
      paperSize,
      accessBlock: {
        qrDataUrl,
        publicAccessCode,
      },
    },
  });
  const filename = buildInvoicePdfFilename(invoice.invoiceNumber);
  const pdfBytes = new Uint8Array(pdfBuffer);

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
