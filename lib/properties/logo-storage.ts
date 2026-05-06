import "server-only";

import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";

const PROPERTY_LOGO_PREFIX = "uploads/property-logos/";
const INVOICE_TEMPLATE_LOGO_PREFIX = "uploads/invoice-templates/";
const MAX_PROPERTY_LOGO_BYTES = 2 * 1024 * 1024;

export function getManagedLogoUrl(pathname: string) {
  return `/api/blob/logo?pathname=${encodeURIComponent(pathname)}`;
}

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN. Add it to your environment before uploading property logos."
    );
  }

  return token;
}

export function getPropertyLogoFileError(file: File) {
  if (file.type !== "image/png") {
    return "Property logo must be a PNG file.";
  }

  if (file.size > MAX_PROPERTY_LOGO_BYTES) {
    return "Property logo must be 2 MB or smaller.";
  }

  return null;
}

function getPngFileError(file: File) {
  if (file.type !== "image/png") {
    return "Logo must be a PNG file.";
  }

  if (file.size > MAX_PROPERTY_LOGO_BYTES) {
    return "Logo must be 2 MB or smaller.";
  }

  return null;
}

async function storeLogoFile(file: File, prefix: string) {
  const storageKey = `${prefix}${randomUUID()}.png`;
  const blob = await put(storageKey, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: "image/png",
    token: getBlobToken(),
  });

  return {
    logoUrl: getManagedLogoUrl(blob.pathname),
    logoStorageKey: blob.pathname,
  };
}

async function removeLogoFile(storageKey?: string | null, prefix?: string) {
  if (!storageKey || (prefix && !storageKey.startsWith(prefix))) {
    return;
  }

  await del(storageKey, {
    token: getBlobToken(),
  });
}

export function getInvoiceTemplateLogoFileError(file: File) {
  return getPngFileError(file);
}

export async function storePropertyLogoFile(file: File) {
  return storeLogoFile(file, PROPERTY_LOGO_PREFIX);
}

export async function storeInvoiceTemplateLogoFile(file: File) {
  return storeLogoFile(file, INVOICE_TEMPLATE_LOGO_PREFIX);
}

export async function removePropertyLogoFile(storageKey?: string | null) {
  await removeLogoFile(storageKey, PROPERTY_LOGO_PREFIX);
}

export async function removeInvoiceTemplateLogoFile(storageKey?: string | null) {
  await removeLogoFile(storageKey, INVOICE_TEMPLATE_LOGO_PREFIX);
}
