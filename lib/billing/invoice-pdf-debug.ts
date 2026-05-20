import "server-only";

import { getInvoicePdfDebugHeadersEnabled } from "@/lib/billing/invoice-pdf-config";

export function buildInvoicePdfDebugHeaders({
  invoiceId,
  issueDate,
  renderer,
  template = "html",
}: {
  invoiceId: string;
  issueDate: Date;
  renderer: string;
  template?: "html" | "react-pdf";
}) {
  if (!getInvoicePdfDebugHeadersEnabled()) {
    return {} as Record<string, string>;
  }

  return {
    "X-Invoice-Renderer": renderer,
    "X-Invoice-Template": template,
    "X-Invoice-Id": invoiceId,
    "X-Invoice-Issue-Date": issueDate.toISOString(),
  };
}
