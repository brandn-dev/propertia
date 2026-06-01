"use client";

import { useActionState, useMemo, useState } from "react";
import { CircleDollarSign, LoaderCircle } from "lucide-react";
import type { BulkRecordPaymentFormState } from "@/app/(dashboard)/billing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useActionRedirect } from "@/components/ui/use-action-redirect";
import { useActionToast } from "@/components/ui/toast-provider";
import { formatCurrency, toDateInputValue } from "@/lib/format";

const initialState: BulkRecordPaymentFormState = {};

type SelectedInvoice = {
  id: string;
  invoiceNumber: string;
  tenantLabel: string;
  propertyLabel: string;
  balanceDue: number;
};

type BulkRecordPaymentSheetProps = {
  action: (
    state: BulkRecordPaymentFormState,
    formData: FormData
  ) => Promise<BulkRecordPaymentFormState>;
  invoices: SelectedInvoice[];
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function BulkRecordPaymentSheet({
  action,
  invoices,
}: BulkRecordPaymentSheetProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  useActionRedirect(state.redirectTo);
  useActionToast({
    message: state.message,
    title: "Bulk full payment blocked",
    intent: "error",
  });

  const serializedInvoiceIds = useMemo(
    () => JSON.stringify(invoices.map((invoice) => invoice.id)),
    [invoices]
  );
  const totalBalance = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    [invoices]
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        disabled={invoices.length === 0}
        className="rounded-full"
      >
        <CircleDollarSign />
        Mark selected fully paid
      </Button>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle>Bulk full payment</SheetTitle>
          <SheetDescription>
            Creates one settled payment per selected invoice and allocates the
            full remaining balance.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-6 px-6 py-6">
          <input type="hidden" name="invoiceIds" value={serializedInvoiceIds} readOnly />

          <div className="rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground">
              Selected invoices
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold tracking-[-0.04em]">
                {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(totalBalance)} total remaining
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {invoices.slice(0, 6).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {invoice.tenantLabel} · {invoice.propertyLabel}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">
                    {formatCurrency(invoice.balanceDue)}
                  </p>
                </div>
              ))}
              {invoices.length > 6 ? (
                <p className="text-xs text-muted-foreground">
                  +{invoices.length - 6} more invoice
                  {invoices.length - 6 === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            <FieldError message={state.errors?.invoiceIds?.[0]} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-payment-date">Payment date</Label>
              <Input
                id="bulk-payment-date"
                name="paymentDate"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.paymentDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-reference-number">Reference number</Label>
              <Input
                id="bulk-reference-number"
                name="referenceNumber"
                placeholder="Optional shared reference"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.referenceNumber?.[0]} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-notes">Notes</Label>
            <Textarea
              id="bulk-notes"
              name="notes"
              placeholder="Optional note applied to every payment record in this batch."
              className="field-blank min-h-24"
            />
            <FieldError message={state.errors?.notes?.[0]} />
          </div>

          {state.message ? (
            <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
              {state.message}
            </div>
          ) : null}

          <SheetFooter className="px-0 pb-0">
            <Button
              type="submit"
              disabled={pending || invoices.length === 0}
              className="w-full rounded-full"
            >
              {pending ? <LoaderCircle className="animate-spin" /> : <CircleDollarSign />}
              {pending ? "Recording full payments..." : "Confirm full payment"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
