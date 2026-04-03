import "server-only";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/prisma";
import { getSessionPassword } from "@/lib/auth/session";

const ACCESS_CODE_LENGTH = 6;
const ACCESS_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_GRANTED_INVOICES = 50;

type InvoiceAccessSessionData = {
  allowedInvoiceIds?: string[];
};

function normalizeAppUrl(appUrl: string | undefined) {
  if (!appUrl) {
    return null;
  }

  return appUrl.trim().replace(/\/+$/, "");
}

function getInvoiceAccessSessionOptions() {
  return {
    cookieName: "propertia_invoice_access",
    password: getSessionPassword(),
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

export function getPublicInvoicePath(invoiceId: string) {
  return `/invoice/${invoiceId}`;
}

export function getPublicInvoiceUrl(invoiceId: string) {
  const appUrl = normalizeAppUrl(process.env.APP_URL);

  if (!appUrl) {
    return null;
  }

  return `${appUrl}${getPublicInvoicePath(invoiceId)}`;
}

export function generateInvoiceAccessCode() {
  let code = "";

  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    code += ACCESS_CODE_CHARSET[randomInt(ACCESS_CODE_CHARSET.length)];
  }

  return code;
}

export async function ensureInvoicePublicAccessCode(
  invoiceId: string,
  currentCode?: string | null
) {
  if (currentCode) {
    return currentCode;
  }

  const nextCode = generateInvoiceAccessCode();
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      publicAccessCode: nextCode,
    },
    select: {
      publicAccessCode: true,
    },
  });

  return invoice.publicAccessCode ?? nextCode;
}

export async function getInvoiceAccessSession() {
  const session = await getIronSession<InvoiceAccessSessionData>(
    await cookies(),
    getInvoiceAccessSessionOptions()
  );

  session.allowedInvoiceIds ??= [];

  return session;
}

export async function hasGrantedInvoiceAccess(invoiceId: string) {
  const session = await getInvoiceAccessSession();
  return session.allowedInvoiceIds?.includes(invoiceId) ?? false;
}

export async function grantInvoiceAccess(invoiceId: string) {
  const session = await getInvoiceAccessSession();
  const nextIds = new Set(session.allowedInvoiceIds ?? []);
  nextIds.add(invoiceId);
  session.allowedInvoiceIds = Array.from(nextIds).slice(-MAX_GRANTED_INVOICES);
  await session.save();
}
