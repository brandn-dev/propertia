import "server-only";

import type { InvoicePaperSize } from "@/lib/billing/invoice-pdf-options";

const GOTENBERG_ENDPOINT_PATH = "/forms/chromium/convert/url";

export async function renderHtmlInvoicePdfBufferWithGotenberg({
  url,
  paperSize: _paperSize,
  invoiceNumber,
}: {
  url: string;
  paperSize: InvoicePaperSize;
  invoiceNumber: string;
}) {
  void _paperSize;
  const gotenbergUrl = process.env.GOTENBERG_URL?.trim();

  if (!gotenbergUrl) {
    throw new Error(
      "GOTENBERG_URL is not configured. Set it when using INVOICE_PDF_RENDER_MODE=gotenberg."
    );
  }

  const endpoint = new URL(GOTENBERG_ENDPOINT_PATH, withTrailingSlash(gotenbergUrl));
  const formData = new FormData();

  formData.set("url", url);
  formData.set("preferCssPageSize", "true");
  formData.set("printBackground", "true");
  formData.set("emulatedMediaType", "print");
  formData.set("waitForExpression", "document.fonts && document.fonts.status === 'loaded'");
  formData.set("waitDelay", "1s");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Gotenberg-Output-Filename": buildInvoicePdfOutputFilename(invoiceNumber),
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Gotenberg PDF render failed with ${response.status}${details ? `: ${details}` : ""}`
    );
  }

  const pdfBuffer = Buffer.from(await response.arrayBuffer());

  if (pdfBuffer.length === 0) {
    throw new Error("Gotenberg returned an empty PDF response.");
  }

  return pdfBuffer;
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildInvoicePdfOutputFilename(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safeInvoiceNumber || "invoice";
}
