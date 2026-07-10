import { notFound, redirect } from "next/navigation";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { getCurrentUser } from "@/lib/auth/user";
import { parseInvoicePaperSize } from "@/lib/billing/invoice-pdf-options";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import { hasGrantedInvoiceAccess } from "@/lib/billing/public-access";
import { getInvoiceForPublicView } from "@/lib/data/billing";

type PublicInvoicePrintPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
  searchParams: Promise<{
    paper?: string | string[];
  }>;
};

export default async function PublicInvoicePrintPage({
  params,
  searchParams,
}: PublicInvoicePrintPageProps) {
  const { invoiceId } = await params;
  const query = await searchParams;
  const paperSize = parseInvoicePaperSize(query.paper);
  const invoice = await getInvoiceForPublicView(invoiceId);

  if (!invoice) {
    notFound();
  }

  const user = await getCurrentUser();
  const hasAccess = user ? true : await hasGrantedInvoiceAccess(invoice.id);

  if (!hasAccess) {
    redirect(`/invoice/${invoice.id}`);
  }

  return (
    <main className="min-h-svh bg-white px-5 py-8 print:p-0">
      <div className="mx-auto max-w-6xl">
        <InvoiceDocument
          model={buildInvoicePresentationModel(invoice)}
          renderMode="print"
          paperSize={paperSize}
          layoutMode="paper"
        />
      </div>
    </main>
  );
}
