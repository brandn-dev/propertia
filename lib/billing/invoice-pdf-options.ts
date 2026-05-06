export const DEFAULT_INVOICE_PAPER_SIZE = "letter";

export const INVOICE_PAPER_SIZE_OPTIONS = [
  {
    value: "letter",
    label: "US Letter",
    cssPageSize: "Letter portrait",
    previewWidth: "8.5in",
    previewMinHeight: "11in",
    metaMinWidth: "22rem",
    compact: false,
  },
  {
    value: "a4",
    label: "A4",
    cssPageSize: "A4 portrait",
    previewWidth: "8.27in",
    previewMinHeight: "11.69in",
    metaMinWidth: "20rem",
    compact: true,
  },
  {
    value: "legal",
    label: "US Legal",
    cssPageSize: "Legal portrait",
    previewWidth: "8.5in",
    previewMinHeight: "14in",
    metaMinWidth: "22rem",
    compact: false,
  },
] as const;

export type InvoicePaperSize =
  (typeof INVOICE_PAPER_SIZE_OPTIONS)[number]["value"];

export function parseInvoicePaperSize(
  value: string | string[] | null | undefined
): InvoicePaperSize {
  const candidate = Array.isArray(value) ? value[0] : value;

  return INVOICE_PAPER_SIZE_OPTIONS.some((option) => option.value === candidate)
    ? (candidate as InvoicePaperSize)
    : DEFAULT_INVOICE_PAPER_SIZE;
}

export function getInvoicePaperSizePreset(
  paperSize: InvoicePaperSize = DEFAULT_INVOICE_PAPER_SIZE
) {
  return (
    INVOICE_PAPER_SIZE_OPTIONS.find((option) => option.value === paperSize) ??
    INVOICE_PAPER_SIZE_OPTIONS[0]
  );
}

export function buildInvoicePdfSearchParams({
  paperSize,
  download = false,
}: {
  paperSize?: InvoicePaperSize;
  download?: boolean;
}) {
  const params = new URLSearchParams();

  if (paperSize && paperSize !== DEFAULT_INVOICE_PAPER_SIZE) {
    params.set("paper", paperSize);
  }

  if (download) {
    params.set("download", "1");
  }

  return params.toString();
}
