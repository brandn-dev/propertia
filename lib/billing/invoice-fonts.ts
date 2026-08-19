export const INVOICE_FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Nunito Sans", label: "Nunito Sans" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Poppins", label: "Poppins" },
  { value: "Roboto", label: "Roboto" },
] as const;

export const INVOICE_FONT_FAMILIES = INVOICE_FONT_OPTIONS.map(
  (font) => font.value
) as [string, ...string[]];

export const DEFAULT_INVOICE_FONT_FAMILY = "Inter";

export function isInvoiceFontFamily(value: string): boolean {
  return INVOICE_FONT_OPTIONS.some((font) => font.value === value);
}
