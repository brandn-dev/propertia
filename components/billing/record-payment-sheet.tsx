"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { RecordPaymentFormState } from "@/app/(dashboard)/billing/actions";
import { PaymentForm } from "@/components/billing/payment-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type RecordPaymentSheetProps = {
  formAction: (
    state: RecordPaymentFormState,
    formData: FormData
  ) => Promise<RecordPaymentFormState>;
  cycleLabel: string;
  tenantLabel: string;
  propertyLabel: string;
  invoiceNumber: string;
  invoiceBalance: number;
  dueDateLabel: string;
  initialValues: {
    paymentDate: string;
    referenceNumber: string;
    notes: string;
  };
  items: {
    id: string;
    itemType:
      | "RENT"
      | "RECURRING_CHARGE"
      | "UTILITY_READING"
      | "COSA"
      | "ADJUSTMENT"
      | "ARREARS";
    description: string;
    amount: number;
    allocatedAmount: number;
    remainingAmount: number;
  }[];
};

export function RecordPaymentSheet({
  formAction,
  cycleLabel,
  tenantLabel,
  propertyLabel,
  invoiceNumber,
  invoiceBalance,
  dueDateLabel,
  initialValues,
  items,
}: RecordPaymentSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        <Plus />
        Record payment
      </Button>

      <SheetContent side="right" className="w-full overflow-y-auto p-0 data-[side=right]:sm:max-w-6xl">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle>{`Record payment · ${cycleLabel}`}</SheetTitle>
          <SheetDescription>
            {`Apply payment for ${tenantLabel} at ${propertyLabel}. Full allocation stays in this panel.`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6">
          <PaymentForm
            formAction={formAction}
            invoiceNumber={invoiceNumber}
            invoiceBalance={invoiceBalance}
            dueDateLabel={dueDateLabel}
            initialValues={initialValues}
            backHref={null}
            items={items}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
