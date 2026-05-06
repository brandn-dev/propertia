"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { withToast } from "@/lib/toast";

function revalidateBillingViews(invoiceId: string) {
  [
    "/billing",
    "/billing/backlog",
    `/billing/${invoiceId}`,
    `/billing/${invoiceId}/pdf`,
    `/billing/${invoiceId}/print`,
    `/invoice/${invoiceId}`,
    `/invoice/${invoiceId}/pdf`,
    `/invoice/${invoiceId}/print`,
  ].forEach((path) => revalidatePath(path));
}

export async function deleteBacklogInvoiceAction(invoiceId: string) {
  await requireRole("ADMIN");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      origin: true,
      payments: {
        select: {
          id: true,
        },
        take: 1,
      },
      items: {
        select: {
          meterReading: {
            select: {
              id: true,
              origin: true,
              cosa: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    redirect(
      withToast("/billing", {
        intent: "error",
        title: "Invoice missing",
        description: "Invoice could not be found.",
      })
    );
  }

  if (invoice.payments.length > 0) {
    redirect(
      withToast(`/billing/${invoice.id}`, {
        intent: "error",
        title: "Delete blocked",
        description: "Cannot delete backlog invoice with recorded payments.",
      })
    );
  }

  const linkedBacklogReadingIds = Array.from(
    new Set(
      invoice.items
        .map((item) => item.meterReading)
        .filter(
          (
            reading
          ): reading is NonNullable<(typeof invoice.items)[number]["meterReading"]> =>
            Boolean(reading && reading.origin === "BACKLOG" && !reading.cosa)
        )
        .map((reading) => reading.id)
    )
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({
        where: { id: invoice.id },
      });

      if (linkedBacklogReadingIds.length > 0) {
        await tx.meterReading.deleteMany({
          where: {
            id: {
              in: linkedBacklogReadingIds,
            },
            origin: "BACKLOG",
            cosa: null,
          },
        });
      }
    });
  } catch {
    redirect(
      withToast(`/billing/${invoice.id}`, {
        intent: "error",
        title: "Delete failed",
        description: "Invoice could not be deleted.",
      })
    );
  }

  revalidateBillingViews(invoice.id);
  redirect(
    withToast("/billing", {
      intent: "success",
      title: "Invoice deleted",
      description: `Deleted ${invoice.invoiceNumber}.`,
    })
  );
}

export const deleteInvoiceAction = deleteBacklogInvoiceAction;
