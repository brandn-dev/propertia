import { redirect } from "next/navigation";
import {
  buildInvoicePdfSearchParams,
  parseInvoicePaperSize,
} from "@/lib/billing/invoice-pdf-options";

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
  const { invoiceId } = await params;
  const query = await searchParams;
  const paperSize = parseInvoicePaperSize(query.paper);
  const pdfQuery = buildInvoicePdfSearchParams({ paperSize });

  redirect(
    pdfQuery
      ? `/billing/${invoiceId}/pdf/file?${pdfQuery}`
      : `/billing/${invoiceId}/pdf/file`
  );
}
