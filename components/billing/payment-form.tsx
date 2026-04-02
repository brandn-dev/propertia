"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, RotateCcw, Save } from "lucide-react";
import type { RecordPaymentFormState } from "@/app/(dashboard)/billing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";

const initialState: RecordPaymentFormState = {};

type PaymentFormProps = {
  formAction: (
    state: RecordPaymentFormState,
    formData: FormData
  ) => Promise<RecordPaymentFormState>;
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
    itemType: "RENT" | "RECURRING_CHARGE" | "UTILITY_READING" | "ADJUSTMENT" | "ARREARS";
    description: string;
    amount: number;
    allocatedAmount: number;
    remainingAmount: number;
  }[];
};

const ITEM_TYPE_LABELS: Record<PaymentFormProps["items"][number]["itemType"], string> = {
  RENT: "Rent",
  RECURRING_CHARGE: "Recurring charge",
  UTILITY_READING: "Utility reading",
  ADJUSTMENT: "Adjustment",
  ARREARS: "Arrears",
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function PaymentForm({
  formAction,
  invoiceNumber,
  invoiceBalance,
  dueDateLabel,
  initialValues,
  items,
}: PaymentFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, ""]))
  );

  function updateAllocation(invoiceItemId: string, value: string) {
    setAllocationValues((current) => ({
      ...current,
      [invoiceItemId]: value,
    }));
  }

  function applyRemainingToItem(invoiceItemId: string, remainingAmount: number) {
    setAllocationValues((current) => ({
      ...current,
      [invoiceItemId]: remainingAmount.toFixed(2),
    }));
  }

  function applyFullBalance() {
    setAllocationValues(
      Object.fromEntries(
        items.map((item) => [item.id, item.remainingAmount.toFixed(2)])
      )
    );
  }

  function clearAllocations() {
    setAllocationValues(Object.fromEntries(items.map((item) => [item.id, ""])));
  }

  const serializedAllocations = JSON.stringify(
    items.map((item) => ({
      invoiceItemId: item.id,
      amount: allocationValues[item.id] || "0",
    }))
  );

  const totalEntered = items.reduce(
    (sum, item) => sum + Number(allocationValues[item.id] || 0),
    0
  );
  const remainingAfterPayment = Math.max(0, invoiceBalance - totalEntered);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="allocations" value={serializedAllocations} readOnly />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="border-blank space-y-6 rounded-[1.85rem] p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment date</Label>
                <Input
                  id="paymentDate"
                  name="paymentDate"
                  type="date"
                  defaultValue={initialValues.paymentDate}
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.paymentDate?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference number</Label>
                <Input
                  id="referenceNumber"
                  name="referenceNumber"
                  defaultValue={initialValues.referenceNumber}
                  placeholder="OR-2026-00124"
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.referenceNumber?.[0]} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={initialValues.notes}
                  placeholder="Optional remarks about this collection, payment split, or follow-up."
                  className="field-blank min-h-24"
                />
                <FieldError message={state.errors?.notes?.[0]} />
              </div>
            </div>

            {state.message ? (
              <div className="rounded-[1.2rem] border border-border/70 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {state.message}
              </div>
            ) : null}
          </div>

          <div className="border-blank rounded-[1.85rem] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">
                  Allocate this payment
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Apply the payment to specific invoice items so rent, recurring
                  fees, and utility balances stay separate.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="button-blank rounded-full"
                  onClick={applyFullBalance}
                >
                  Apply full balance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="button-blank rounded-full"
                  onClick={clearAllocations}
                >
                  <RotateCcw />
                  Clear
                </Button>
              </div>
            </div>

            <FieldError message={state.errors?.allocations?.[0]} />

            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.4rem] border border-border/70 bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <Badge variant="outline" className="rounded-full">
                        {ITEM_TYPE_LABELS[item.itemType]}
                      </Badge>
                      <p className="text-sm font-medium leading-6">{item.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Total: {formatCurrency(item.amount)}</span>
                        <span>Allocated: {formatCurrency(item.allocatedAmount)}</span>
                        <span>Remaining: {formatCurrency(item.remainingAmount)}</span>
                      </div>
                    </div>

                    <div className="w-full max-w-[220px] space-y-2">
                      <Label htmlFor={`allocation-${item.id}`}>Apply amount</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`allocation-${item.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={allocationValues[item.id] ?? ""}
                          onChange={(event) =>
                            updateAllocation(item.id, event.target.value)
                          }
                          className="field-blank h-11"
                          placeholder="0.00"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="button-blank h-11 rounded-xl"
                          onClick={() =>
                            applyRemainingToItem(item.id, item.remainingAmount)
                          }
                        >
                          Max
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-[1.85rem] p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              Payment run
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {invoiceNumber}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Record a payment against the remaining invoice balance. The invoice
              status updates automatically from the resulting balance.
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/70 bg-background/60 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Current balance</span>
                <span className="font-medium">{formatCurrency(invoiceBalance)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Entered amount</span>
                <span className="font-medium">{formatCurrency(totalEntered)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Balance after entry</span>
                <span className="font-medium">
                  {formatCurrency(remainingAfterPayment)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Due date</span>
                <span className="font-medium">{dueDateLabel}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || items.length === 0}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Record payment
              </Button>
              <Button
                render={<Link href="../" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to invoice
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
