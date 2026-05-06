import type { InvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import type { InvoicePaperSize } from "@/lib/billing/invoice-pdf-options";
import { createInvoicePdfRenderToken, type InvoicePdfRenderVariant } from "@/lib/billing/invoice-pdf-token";
import {
  buildInvoicePdfSearchParams,
  DEFAULT_INVOICE_PAPER_SIZE,
} from "@/lib/billing/invoice-pdf-options";
import { renderHtmlInvoicePdfBuffer as renderChromeInvoicePdfBuffer } from "@/lib/billing/invoice-pdf-browser";
import { renderHtmlInvoicePdfBuffer } from "@/lib/billing/invoice-pdf-weasyprint";

export function buildInvoicePdfFilename(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeInvoiceNumber || "invoice"}.pdf`;
}

export function buildInvoiceHtmlPdfUrl({
  requestUrl,
  invoiceId,
  variant,
  paperSize = DEFAULT_INVOICE_PAPER_SIZE,
}: {
  requestUrl: string;
  invoiceId: string;
  variant: InvoicePdfRenderVariant;
  paperSize?: InvoicePaperSize;
}) {
  const token = createInvoicePdfRenderToken({
    invoiceId,
    variant,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const params = new URLSearchParams(
    buildInvoicePdfSearchParams({
      paperSize,
    })
  );

  params.set("pdf_token", token);

  const routePath = `/pdf-render/${variant}/${invoiceId}?${params.toString()}`;

  return new URL(routePath, requestUrl).toString();
}

export async function renderInvoiceBestPdfBuffer({
  requestUrl,
  invoiceId,
  model,
  options,
}: {
  requestUrl: string;
  invoiceId: string;
  model: InvoicePresentationModel;
  options: {
    variant: InvoicePdfRenderVariant;
    paperSize?: InvoicePaperSize;
    accessBlock?: {
      qrDataUrl: string;
      publicAccessCode: string;
    };
  };
}) {
  const url = buildInvoiceHtmlPdfUrl({
    requestUrl,
    invoiceId,
    variant: options.variant,
    paperSize: options.paperSize,
  });

  try {
    return await renderHtmlInvoicePdfBuffer(url);
  } catch (error) {
    console.error("WeasyPrint render failed, falling back to Chrome HTML PDF render.", error, {
      invoiceId,
      variant: options.variant,
      paperSize: options.paperSize,
      itemCount: model.items.length,
    });

    return renderChromeInvoicePdfBuffer(url);
  }
}
