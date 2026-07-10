import { getCurrentUser } from "@/lib/auth/user";
import { buildInvoicePdfDebugHeaders } from "@/lib/billing/invoice-pdf-debug";
import {
  buildInvoicePdfFilename,
  buildInvoicePdfRenderErrorResponse,
  renderInvoiceBestPdfBuffer,
} from "@/lib/billing/invoice-pdf";
import { parseInvoicePaperSize } from "@/lib/billing/invoice-pdf-options";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import { hasGrantedInvoiceAccess } from "@/lib/billing/public-access";
import { getInvoiceForPublicView } from "@/lib/data/billing";

type PublicInvoicePdfFileRouteProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: PublicInvoicePdfFileRouteProps
) {
  const { invoiceId } = await params;
  const invoice = await getInvoiceForPublicView(invoiceId);

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const user = await getCurrentUser();
  const hasAccess = user ? true : await hasGrantedInvoiceAccess(invoice.id);

  if (!hasAccess) {
    return new Response("Invoice access denied", { status: 403 });
  }

  const url = new URL(request.url);
  const shouldDownload = url.searchParams.get("download") === "1";
  const paperSize = parseInvoicePaperSize(url.searchParams.get("paper"));
  const model = buildInvoicePresentationModel(invoice);
  let pdfResult: Awaited<ReturnType<typeof renderInvoiceBestPdfBuffer>>;

  try {
    pdfResult = await renderInvoiceBestPdfBuffer({
      requestUrl: request.url,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      model,
      options: {
        variant: "public",
        paperSize,
      },
    });
  } catch (error) {
    const errorResponse = buildInvoicePdfRenderErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  const { buffer: pdfBuffer, renderer } = pdfResult;
  const filename = buildInvoicePdfFilename(invoice.invoiceNumber);
  const pdfBytes = new Uint8Array(pdfBuffer);

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      ...buildInvoicePdfDebugHeaders({
        invoiceId: invoice.id,
        issueDate: invoice.issueDate,
        renderer,
      }),
    },
  });
}
