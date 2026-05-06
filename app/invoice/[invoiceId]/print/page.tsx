import { redirect } from "next/navigation";
import {
  buildInvoicePdfSearchParams,
  parseInvoicePaperSize,
} from "@/lib/billing/invoice-pdf-options";

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
  const pdfQuery = buildInvoicePdfSearchParams({ paperSize });

  redirect(
    pdfQuery
      ? `/invoice/${invoiceId}/pdf/file?${pdfQuery}`
      : `/invoice/${invoiceId}/pdf/file`
  );
}
