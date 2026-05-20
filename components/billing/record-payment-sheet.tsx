"use client";

import type { ReactNode } from "react";
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
  triggerLabel?: string | null;
  triggerAriaLabel?: string;
  triggerTitle?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  triggerSize?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  triggerClassName?: string;
  triggerIcon?: ReactNode;
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
  triggerLabel = "Record payment",
  triggerAriaLabel,
  triggerTitle,
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  triggerIcon = <Plus />,
  items,
}: RecordPaymentSheetProps) {
  const [open, setOpen] = useState(false);
  const buttonLabel = triggerLabel ?? triggerAriaLabel ?? "Record payment";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName ?? "rounded-full"}
        aria-label={buttonLabel}
        title={triggerTitle ?? buttonLabel}
        onClick={() => setOpen(true)}
      >
        {triggerIcon}
        {triggerLabel ? triggerLabel : <span className="sr-only">{buttonLabel}</span>}
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
