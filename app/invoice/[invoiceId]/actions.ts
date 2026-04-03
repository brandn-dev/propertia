"use server";

import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/user";
import {
  ensureInvoicePublicAccessCode,
  getPublicInvoicePath,
  grantInvoiceAccess,
} from "@/lib/billing/public-access";
import {
  type PublicInvoiceAccessFormState,
  publicInvoiceAccessSchema,
} from "@/lib/validations/public-invoice-access";

const invoicePublicAccessSelect = {
  id: true,
  publicAccessCode: true,
} satisfies Prisma.InvoiceSelect;

export async function unlockPublicInvoiceAction(
  invoiceId: string,
  _previousState: PublicInvoiceAccessFormState,
  formData: FormData
): Promise<PublicInvoiceAccessFormState> {
  const user = await getCurrentUser();

  if (user) {
    redirect(getPublicInvoicePath(invoiceId));
  }

  const validatedFields = publicInvoiceAccessSchema.safeParse({
    accessCode: formData.get("accessCode"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Enter the invoice password to continue.",
    };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: invoicePublicAccessSelect,
  });

  if (!invoice) {
    return {
      message: "Invoice no longer exists.",
    };
  }

  const accessCode = await ensureInvoicePublicAccessCode(
    invoice.id,
    invoice.publicAccessCode
  );

  if (validatedFields.data.accessCode !== accessCode.toUpperCase()) {
    return {
      message: "Invoice password is invalid.",
    };
  }

  await grantInvoiceAccess(invoice.id);
  redirect(getPublicInvoicePath(invoice.id));
}
