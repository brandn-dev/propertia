import { requireCapability } from "@/lib/auth/user";
import { getInvoicePdfEnvironmentSnapshot } from "@/lib/billing/invoice-pdf-config";
import { getInvoiceForView } from "@/lib/data/billing";

type InvoicePdfDebugRouteProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: InvoicePdfDebugRouteProps
) {
  await requireCapability("MANAGE_BILLING");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    return Response.json({ message: "Invoice not found" }, { status: 404 });
  }

  return Response.json({
    requestUrl: request.url,
    environment: getInvoicePdfEnvironmentSnapshot(),
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      billingPeriodStart: invoice.billingPeriodStart.toISOString(),
      billingPeriodEnd: invoice.billingPeriodEnd.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    },
  });
}
