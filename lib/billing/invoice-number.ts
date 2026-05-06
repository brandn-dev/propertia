import { randomUUID } from "node:crypto";

function normalizePropertyCode(propertyCode: string) {
  const cleaned = propertyCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (!cleaned) {
    return "PROP";
  }

  if (cleaned.length <= 4) {
    return cleaned;
  }

  return cleaned.slice(-4);
}

export function buildInvoiceNumber(issueDate: Date, propertyCode: string) {
  const year = String(issueDate.getFullYear()).slice(-2);
  const month = String(issueDate.getMonth() + 1).padStart(2, "0");
  const day = String(issueDate.getDate()).padStart(2, "0");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  const propertyToken = normalizePropertyCode(propertyCode);

  return `INV-${year}${month}${day}-${propertyToken}-${suffix}`;
}
