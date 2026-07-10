import "server-only";

export const INVOICE_PDF_RENDER_MODES = [
  "gotenberg",
  "chromium",
  "react-pdf",
] as const;

export type InvoicePdfRenderMode = (typeof INVOICE_PDF_RENDER_MODES)[number];

function normalizeBaseUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return new URL(trimmedValue).toString();
  } catch {
    return null;
  }
}

export function parseInvoicePdfRenderMode(
  value: string | null | undefined
): InvoicePdfRenderMode | null {
  if (!value) {
    return null;
  }

  return INVOICE_PDF_RENDER_MODES.includes(value as InvoicePdfRenderMode)
    ? (value as InvoicePdfRenderMode)
    : null;
}

export function getConfiguredInvoicePdfRenderMode() {
  return parseInvoicePdfRenderMode(process.env.INVOICE_PDF_RENDER_MODE);
}

export function getInvoicePdfRenderMode() {
  const configured = getConfiguredInvoicePdfRenderMode();

  if (configured) {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "gotenberg" : "chromium";
}

export function getInvoicePdfDebugHeadersEnabled() {
  const configured = process.env.INVOICE_PDF_DEBUG_HEADERS?.trim().toLowerCase();

  return (
    (configured ? configured !== "0" && configured !== "false" : false) ||
    process.env.NODE_ENV !== "production"
  );
}

export function getInvoicePdfRenderBaseUrl(requestUrl: string) {
  return (
    normalizeBaseUrl(process.env.INVOICE_PDF_RENDER_BASE_URL) ??
    normalizeBaseUrl(process.env.APP_URL) ??
    requestUrl
  );
}

export function getDatabaseSourceLabel() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    return "unconfigured";
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "invalid";
  }
}

export function getInvoicePdfEnvironmentSnapshot() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    appUrl: process.env.APP_URL ?? null,
    invoicePdfRenderBaseUrl: process.env.INVOICE_PDF_RENDER_BASE_URL ?? null,
    rendererMode: getInvoicePdfRenderMode(),
    rendererModeConfigured: getConfiguredInvoicePdfRenderMode(),
    gotenbergUrl: process.env.GOTENBERG_URL ?? null,
    databaseSource: getDatabaseSourceLabel(),
  };
}
