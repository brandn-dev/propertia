import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePenLine, ReceiptText, Trash2 } from "lucide-react";
import { deleteBacklogInvoiceAction } from "@/app/(dashboard)/billing/[invoiceId]/actions";
import {
  updateBacklogInvoiceAction,
  updateGeneratedInvoiceDescriptionsAction,
} from "@/app/(dashboard)/billing/[invoiceId]/edit/actions";
import { BacklogInvoiceEditForm } from "@/components/billing/backlog-invoice-edit-form";
import { GeneratedInvoiceDescriptionForm } from "@/components/billing/generated-invoice-description-form";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/user";
import { buildInvoicePresentationModel } from "@/lib/billing/invoice-presenter";
import { getInvoiceForView } from "@/lib/data/billing";
import { toDateInputValue, toNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type BacklogInvoiceEditPageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export default async function BacklogInvoiceEditPage({
  params,
}: BacklogInvoiceEditPageProps) {
  await requireCapability("MANAGE_BILLING");
  const { invoiceId } = await params;
  const invoice = await getInvoiceForView(invoiceId);

  if (!invoice) {
    notFound();
  }

  if (invoice.origin === "GENERATED") {
    const presentationModel = buildInvoicePresentationModel(invoice);
    const descriptionByItemId = new Map(
      presentationModel.items.map((item) => [item.id, item.description])
    );

    return (
      <div className="space-y-6">
        <DashboardPageHero
          eyebrow="Operations / Billing"
          title="Edit invoice descriptions"
          description="Override line-item wording on this generated invoice. You can keep defaults, force show or hide dates on supported rows, or save custom descriptions."
          icon={FilePenLine}
          badges={["Generated invoice", invoice.invoiceNumber]}
          action={
            <Button
              render={<Link href={`/billing/${invoice.id}`} />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <ReceiptText />
              Back to invoice
            </Button>
          }
        />

        <GeneratedInvoiceDescriptionForm
          invoiceId={invoice.id}
          formAction={updateGeneratedInvoiceDescriptionsAction}
          initialValues={{
            items: invoice.items.map((item) => ({
              id: item.id,
              itemType: item.itemType,
              typeLabel:
                presentationModel.items.find(
                  (presentationItem) => presentationItem.id === item.id
                )?.typeLabel ?? item.itemType.replaceAll("_", " "),
              currentDescription:
                descriptionByItemId.get(item.id) ?? item.description,
              descriptionMode: item.descriptionMode,
              customDescription:
                item.customDescription ??
                (descriptionByItemId.get(item.id) ?? item.description),
              supportsDateVisibilityOverride:
                item.itemType === "RENT" || item.itemType === "RECURRING_CHARGE",
            })),
          }}
        />
      </div>
    );
  }

  if (invoice.payments.length > 0) {
    return (
      <div className="space-y-6">
        <DashboardPageHero
          eyebrow="Operations / Billing"
          title="Backlog invoice locked"
          description="This backlog invoice already has payment records. Remove those payments first before editing the invoice body."
          icon={FilePenLine}
          badges={["Backlog only", "Payments detected"]}
          action={
            <Button
              render={<Link href={`/billing/${invoice.id}`} />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <ReceiptText />
              Back to invoice
            </Button>
          }
        />
      </div>
    );
  }

  const deleteBacklogInvoice = deleteBacklogInvoiceAction.bind(null, invoice.id);

  const availableMeters = await prisma.utilityMeter.findMany({
    where: {
      propertyId: invoice.contract.property.id,
      tenantId: invoice.tenantId,
      isShared: false,
    },
    orderBy: [{ utilityType: "asc" }, { meterCode: "asc" }],
    select: {
      id: true,
      meterCode: true,
      utilityType: true,
    },
  });
  const isAutoManagedBacklogLine = (itemType: string, description: string) =>
    itemType === "ADJUSTMENT" &&
    (description.startsWith("Free rent concession · ") ||
      description.startsWith("Advance rent charge · ") ||
      description.startsWith("Advance rent applied · "));

  const editableItems = invoice.items
    .filter(
      (item) =>
        (Boolean(item.meterReading) ||
          (!item.cosaAllocation && !item.contractRecurringCharge)) &&
        !isAutoManagedBacklogLine(item.itemType, item.description)
    )
    .map((item) => ({
      id: item.id,
      itemType: item.itemType,
      description: item.description,
      amount: toNumber(item.amount).toFixed(2),
      mode: item.meterReading ? ("meter" as const) : ("manual" as const),
      meterReadingId: item.meterReading?.id,
      meterCode: item.meterReading?.meter.meterCode,
      utilityType: item.meterReading?.meter.utilityType,
      readingDate: item.meterReading
        ? toDateInputValue(item.meterReading.readingDate)
        : undefined,
      previousReading: item.meterReading
        ? toNumber(item.meterReading.previousReading).toFixed(2)
        : undefined,
      currentReading: item.meterReading
        ? toNumber(item.meterReading.currentReading).toFixed(2)
        : undefined,
      ratePerUnit: item.meterReading
        ? toNumber(item.meterReading.ratePerUnit).toFixed(2)
        : undefined,
    }));
  const readOnlyItems = invoice.items
    .filter(
      (item) =>
        Boolean(item.cosaAllocation || item.contractRecurringCharge) ||
        isAutoManagedBacklogLine(item.itemType, item.description)
    )
    .map((item) => ({
      id: item.id,
      itemType: item.itemType,
      description: item.description,
      amount: toNumber(item.amount).toFixed(2),
    }));

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Edit backlog invoice"
        description="Adjust manual backlog invoice dates, notes, and editable line items before collections continue."
        icon={FilePenLine}
        badges={["Backlog only", invoice.invoiceNumber]}
        action={
          <div className="flex flex-wrap gap-2">
            <form action={deleteBacklogInvoice}>
              <Button type="submit" variant="destructive" className="rounded-full">
                <Trash2 />
                Delete backlog invoice
              </Button>
            </form>
            <Button
              render={<Link href={`/billing/${invoice.id}`} />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <ReceiptText />
              Back to invoice
            </Button>
          </div>
        }
      />

      <BacklogInvoiceEditForm
        invoiceId={invoice.id}
        availableMeters={availableMeters}
        formAction={updateBacklogInvoiceAction}
        initialValues={{
          issueDate: toDateInputValue(invoice.issueDate),
          dueDate: toDateInputValue(invoice.dueDate),
          billingPeriodStart: toDateInputValue(invoice.billingPeriodStart),
          billingPeriodEnd: toDateInputValue(invoice.billingPeriodEnd),
          notes: invoice.notes ?? "",
          editableItems,
          readOnlyItems,
        }}
      />
    </div>
  );
}
