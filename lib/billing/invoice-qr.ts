import "server-only";

import QRCode from "qrcode";
import { getPublicInvoiceUrl } from "@/lib/billing/public-access";

type InvoiceQrPayload = {
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  propertyName: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number;
  balanceDue: number;
};

export function getInvoiceQrTarget(payload: InvoiceQrPayload) {
  return getPublicInvoiceUrl(payload.invoiceId) ?? `/invoice/${payload.invoiceId}`;
}

export async function generateInvoiceQrDataUrl(payload: InvoiceQrPayload) {
  return QRCode.toDataURL(getInvoiceQrTarget(payload), {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    color: {
      dark: "#111827",
      light: "#FFFFFFFF",
    },
  });
}
